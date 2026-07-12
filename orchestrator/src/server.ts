import { createServer, type IncomingMessage } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { loadConfig } from "./config.js";
import { PelozenScraperSource } from "./leadSource/pelozenScraperSource.js";
import { ingestLeads } from "./leadIngest.js";

/**
 * Minimal HTTP surface for the panel. One real endpoint today — POST /scrape —
 * which scrapes a pelozen topic and ingests the leads. The dialer/run endpoints
 * will join this server later. Uses Node's built-in http (no framework dep).
 */
export function startServer() {
  const cfg = loadConfig();
  const db = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, { auth: { persistSession: false } });
  const scraper = new PelozenScraperSource({
    username: process.env.PELOZEN_USERNAME ?? "",
    password: process.env.PELOZEN_PASSWORD ?? "",
    storageStatePath: ".pelozen-session.json",
  });

  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (req.method === "GET" && req.url === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "POST" && req.url?.startsWith("/scrape")) {
      try {
        const body = await readJson(req);
        const campaignId = String(body.campaignId ?? "");
        const interestId = String(body.interestId ?? "");
        const count = Number(body.count) || 20;
        if (!campaignId || !interestId) {
          json(res, 400, { error: "campaignId and interestId required" });
          return;
        }
        const { leads, rejected } = await scraper.loadBatch(interestId, count);
        const ingest = await ingestLeads(db, campaignId, leads, cfg.phoneHashSecret);
        json(res, 200, { ...ingest, invalid: rejected.length });
      } catch (e) {
        json(res, 500, { error: (e as Error).message });
      }
      return;
    }

    res.writeHead(404); res.end("not found");
  });

  server.listen(cfg.port, () => console.log(`orchestrator http listening on :${cfg.port}`));
  return server;
}

function json(res: import("node:http").ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}
