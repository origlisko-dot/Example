import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { chromium, type Browser, type BrowserContext } from "playwright";
import { normalizeIsraeliPhone, InvalidPhoneError, type RawLead } from "@pelozen/shared";
import type { LeadSource, LoadResult } from "./index.js";
import { topicName } from "./pelozenTopics.js";

/**
 * pelozen lead scraper via Playwright (headless Chromium).
 *
 * We pivoted here from raw HTTP because the site uses a cross-domain PHP auth
 * handoff (login on m.pelozen.co.il → session for www.pelozen.co.il via a
 * redirect token + separate `pls` cookie) that a hand-rolled cookie jar can't
 * reproduce reliably. A real browser does it natively.
 *
 * The session (cookies + localStorage) is persisted to disk so we only log in
 * when the stored session has expired — minimizing login events (which anti-bot
 * systems flag).
 *
 * Card shape on /mobile/customers/cold_data (discovered live 2026-06-20):
 *   div.card → button.remove-cust[data-phone|data-id], button.refresh[data-id]
 *   (= interest/topic id), .fullname (name). The ?interest_id= URL param is
 *   ignored server-side, so we filter by topic id here.
 */
const LOGIN_URL = "https://m.pelozen.co.il/login.php";
const COLD_DATA_URL = "https://www.pelozen.co.il/mobile/customers/cold_data";

export class ScraperUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScraperUnavailableError";
  }
}

export interface PelozenCredentials {
  username: string;
  password: string;
  /** where to persist the browser session (gitignored) */
  storageStatePath?: string;
}

interface ScrapedCard {
  phone: string;
  name: string;
  topicId: string;
  leadId: string;
}

export class PelozenScraperSource implements LeadSource {
  readonly kind = "scraper" as const;
  private readonly statePath: string;

  constructor(private readonly creds: PelozenCredentials) {
    this.statePath = creds.storageStatePath ?? ".pelozen-session.json";
  }

  async loadBatch(topicRef: string, count: number): Promise<LoadResult> {
    const browser = await chromium.launch({ headless: true });
    try {
      const cards = await this.scrape(browser, topicRef, count);
      return this.toResult(cards, topicRef, count);
    } finally {
      await browser.close();
    }
  }

  private async newContext(browser: Browser): Promise<BrowserContext> {
    if (existsSync(this.statePath)) {
      const storageState = JSON.parse(await readFile(this.statePath, "utf-8"));
      return browser.newContext({ storageState });
    }
    return browser.newContext();
  }

  private async scrape(browser: Browser, topicRef: string, count: number): Promise<ScrapedCard[]> {
    let context = await this.newContext(browser);
    let page = await context.newPage();

    await page.goto(COLD_DATA_URL, { waitUntil: "domcontentloaded" });

    // If the stored session is gone, we land on login (or the site root).
    if (!page.url().includes("cold_data") || (await page.$("div.card")) === null) {
      await context.close();
      context = await browser.newContext();
      page = await context.newPage();
      await this.login(page);
      await page.goto(COLD_DATA_URL, { waitUntil: "domcontentloaded" });
      await context.storageState({ path: this.statePath });
    }

    // The cold_data pool rotates on every reload, so we loop: filter to the
    // topic, harvest the matching cards, reload for a fresh sample, and stop
    // once we have `count` unique leads or the pool runs dry (3 empty rounds).
    const collected = new Map<string, ScrapedCard>();
    let dryRounds = 0;
    for (let round = 0; round < 20 && collected.size < count && dryRounds < 3; round++) {
      if (round > 0) await page.goto(COLD_DATA_URL, { waitUntil: "domcontentloaded" });
      await this.applyTopicFilter(page, topicRef);

      if ((await page.$("div.card")) === null) {
        if (round === 0) {
          throw new ScraperUnavailableError("no lead cards found — site layout changed or login failed");
        }
        dryRounds++;
        continue;
      }

      const cards = await extractCards(page);
      let added = 0;
      for (const c of cards) {
        if (topicRef && c.topicId !== topicRef) continue;
        if (!c.phone || collected.has(c.phone)) continue;
        collected.set(c.phone, c);
        added++;
        if (collected.size >= count) break;
      }
      dryRounds = added === 0 ? dryRounds + 1 : 0;
    }

    return [...collected.values()];
  }

  /** Filter to one topic via the dropdown + search (the ?interest_id= URL param
   *  is ignored server-side; only this JS path filters). */
  private async applyTopicFilter(page: import("playwright").Page, topicRef: string): Promise<void> {
    if (!topicRef) return;
    try {
      await page.selectOption("#interest_id", topicRef);
      await Promise.all([
        page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {}),
        page.getByRole("button", { name: "חפש" }).click(),
      ]);
      await page.waitForSelector("div.card", { timeout: 8000 }).catch(() => {});
    } catch {
      // fall back to the mixed list; extraction filters by topic id anyway
    }
  }

  private async login(page: import("playwright").Page): Promise<void> {
    await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded" });
    await page.fill('input[name="username"]', this.creds.username);
    await page.fill('input[name="password"]', this.creds.password);
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      page.click('input[type="submit"]'),
    ]);
    if (page.url().includes("login")) {
      throw new ScraperUnavailableError("pelozen login failed — check credentials");
    }
  }

  private toResult(cards: ScrapedCard[], topicRef: string, count: number): LoadResult {
    const leads: RawLead[] = [];
    const rejected: LoadResult["rejected"] = [];
    const seen = new Set<string>();
    const now = new Date().toISOString();

    for (const card of cards) {
      if (leads.length >= count) break;
      if (topicRef && card.topicId !== topicRef) continue;
      if (!card.phone) continue;
      try {
        const phoneE164 = normalizeIsraeliPhone(card.phone);
        if (seen.has(phoneE164)) continue;
        seen.add(phoneE164);
        leads.push({
          phoneE164,
          firstName: cleanName(card.name) || undefined,
          fields: { pelozen_topic_id: card.topicId, pelozen_topic: topicName(card.topicId) },
          topicRef,
          sourceRef: card.leadId || undefined,
          fetchedAt: now,
        });
      } catch (e) {
        rejected.push({ raw: card.phone, reason: e instanceof InvalidPhoneError ? "invalid phone" : "parse error" });
      }
    }
    return { leads, rejected };
  }
}

function extractCards(page: import("playwright").Page): Promise<ScrapedCard[]> {
  return page.$$eval("div.card", (els) =>
    els.map((card) => {
      const remove = card.querySelector("button.remove-cust");
      const refresh = card.querySelector("button.refresh");
      return {
        phone: remove?.getAttribute("data-phone") ?? "",
        leadId: remove?.getAttribute("data-id") ?? "",
        topicId: refresh?.getAttribute("data-id") ?? "",
        name: card.querySelector(".fullname")?.textContent?.trim() ?? "",
      };
    }),
  );
}

function cleanName(raw: string): string {
  return raw
    .replace(/\s*לקוח מדף נחיתה[^\n]*/g, "")
    .replace(/\s*אין\s*$/g, "")
    .trim();
}
