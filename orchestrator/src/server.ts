import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { createClient } from "@supabase/supabase-js";
import { PelozenScraperSource } from "./leadSource/pelozenScraperSource.js";
import { ingestLeads } from "./leadIngest.js";
import { executeRun, RunNotFoundError, RunNotRunnableError } from "./runWorker.js";
import type { OrchestratorBundle } from "./orchestratorApp.js";

/**
 * HTTP surface for the panel:
 *   GET  /health
 *   POST /scrape
 *   POST /run/:runId   — start/resume the sequential dial loop (async)
 */
export function startServer(orchestrator: OrchestratorBundle) {
  const { cfg, controller } = orchestrator;
  const db = createClient(cfg.supabaseUrl, cfg.supabaseServiceRoleKey, { auth: { persistSession: false } });
  const scraper = new PelozenScraperSource({
    username: process.env.PELOZEN_USERNAME ?? "",
    password: process.env.PELOZEN_PASSWORD ?? "",
    storageStatePath: ".pelozen-session.json",
  });

  const activeRuns = new Set<string>();

  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    if (req.method === "GET" && req.url === "/health") {
      const ts = orchestrator.telephonyStatus;
      json(res, 200, {
        ok: true,
        telephonyMode: ts.mode,
        telephonyReady: ts.ready,
        telephony: orchestrator.telephony.kind,
        retellConfigured: ts.retellConfigured,
        gsmConfigured: ts.gsmConfigured,
        pipelineUrl: ts.pipelineUrl,
        hint: ts.hint,
      });
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

    const runMatch = req.method === "POST" && req.url?.match(/^\/run\/([0-9a-f-]{36})$/i);
    if (runMatch) {
      const runId = runMatch[1]!;

      const ts = orchestrator.telephonyStatus;
      if (!ts.ready) {
        json(res, 503, {
          error: ts.hint ?? "Telephony not configured",
          mode: ts.mode,
        });
        return;
      }

      if (activeRuns.has(runId)) {
        json(res, 409, { error: "Run already in progress", runId });
        return;
      }

      activeRuns.add(runId);
      json(res, 202, { accepted: true, runId });

      void executeRun(cfg, controller, runId)
        .then((summary) => console.log(`run ${runId} finished:`, summary))
        .catch((e) => {
          if (e instanceof RunNotFoundError) console.error(e.message);
          else if (e instanceof RunNotRunnableError) console.warn(e.message);
          else console.error(`run ${runId} failed:`, e);
        })
        .finally(() => activeRuns.delete(runId));

      return;
    }

    res.writeHead(404); res.end("not found");
  });

  server.listen(cfg.port, () => {
    const ts = orchestrator.telephonyStatus;
    console.log(
      `orchestrator http listening on :${cfg.port} (mode=${ts.mode}, ready=${ts.ready})`,
    );
  });
  return server;
}

function json(res: ServerResponse, status: number, body: unknown): void {
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
