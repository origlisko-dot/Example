import { test } from "node:test";
import assert from "node:assert/strict";
import { CsvUploadSource } from "./csvUploadSource.js";

test("parses a bare pasted list of numbers", async () => {
  const src = new CsvUploadSource("0545454562\n054-111-2222\n0501234567", "loans");
  const { leads, rejected } = await src.loadBatch("loans", 20);
  assert.equal(leads.length, 3);
  assert.equal(rejected.length, 0);
  assert.equal(leads[0]!.phoneE164, "+972545454562");
  assert.equal(leads[0]!.topicRef, "loans");
});

test("parses CSV with Hebrew headers (שם / טלפון)", async () => {
  const csv = "שם,טלפון,עיר\nדני,054-545-4562,תל אביב\nרונית,0501234567,חיפה";
  const src = new CsvUploadSource(csv, "legal");
  const { leads } = await src.loadBatch("legal", 20);
  assert.equal(leads.length, 2);
  assert.equal(leads[0]!.firstName, "דני");
  assert.equal(leads[0]!.phoneE164, "+972545454562");
  assert.equal(leads[0]!.fields["עיר"], "תל אביב");
});

test("dedupes within the batch and respects count", async () => {
  const src = new CsvUploadSource("0545454562\n054-545-4562\n0501112222", "x");
  const { leads } = await src.loadBatch("x", 20);
  assert.equal(leads.length, 2); // first two are the same number
});

test("rejects invalid rows without crashing", async () => {
  const src = new CsvUploadSource("0545454562\nhello world\n123", "x");
  const { leads, rejected } = await src.loadBatch("x", 20);
  assert.equal(leads.length, 1);
  assert.equal(rejected.length, 2);
});

test("count limit caps the batch", async () => {
  const nums = Array.from({ length: 30 }, (_, i) => `05012345${String(i).padStart(2, "0")}`).join("\n");
  const src = new CsvUploadSource(nums, "x");
  const { leads } = await src.loadBatch("x", 20);
  assert.equal(leads.length, 20);
});
