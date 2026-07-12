/**
 * Manual test: scrape a pelozen topic and print the result (masked).
 * Run: node --env-file=.env --import tsx orchestrator/src/scripts/scrapeTest.ts [interestId] [count]
 */
import { maskPhone } from "@pelozen/shared";
import { PelozenScraperSource } from "../leadSource/pelozenScraperSource.js";

const interestId = process.argv[2] ?? "549";
const count = Number(process.argv[3] ?? "25");

const username = process.env.PELOZEN_USERNAME;
const password = process.env.PELOZEN_PASSWORD;
if (!username || !password) {
  console.error("Missing PELOZEN_USERNAME / PELOZEN_PASSWORD");
  process.exit(1);
}

const src = new PelozenScraperSource({ username, password });
const { leads, rejected } = await src.loadBatch(interestId, count);

console.log(`topic ${interestId}: ${leads.length} leads, ${rejected.length} rejected`);
for (const l of leads) {
  console.log(`  ${maskPhone(l.phoneE164)} | ${l.firstName ?? "(no name)"} | ${l.fields.pelozen_topic}`);
}
if (rejected.length) console.log("rejected:", rejected);
