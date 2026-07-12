import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeIsraeliPhone, isIsraeliMobile, tryNormalizeIsraeliPhone, InvalidPhoneError } from "./phone.js";

test("normalize local mobile formats", () => {
  assert.equal(normalizeIsraeliPhone("0545454562"), "+972545454562");
  assert.equal(normalizeIsraeliPhone("054-545-4562"), "+972545454562");
  assert.equal(normalizeIsraeliPhone("054 545 4562"), "+972545454562");
});

test("normalize international formats", () => {
  assert.equal(normalizeIsraeliPhone("+972545454562"), "+972545454562");
  assert.equal(normalizeIsraeliPhone("972545454562"), "+972545454562");
  assert.equal(normalizeIsraeliPhone("00972-54-5454562"), "+972545454562");
});

test("landline (8-digit subscriber) normalizes", () => {
  assert.equal(normalizeIsraeliPhone("03-1234567"), "+97231234567");
});

test("invalid numbers throw", () => {
  assert.throws(() => normalizeIsraeliPhone("12345"), InvalidPhoneError);
  assert.throws(() => normalizeIsraeliPhone(""), InvalidPhoneError);
  assert.throws(() => normalizeIsraeliPhone("not a phone"), InvalidPhoneError);
});

test("tryNormalize returns null instead of throwing", () => {
  assert.equal(tryNormalizeIsraeliPhone("12345"), null);
  assert.equal(tryNormalizeIsraeliPhone("0545454562"), "+972545454562");
});

test("mobile detection", () => {
  assert.equal(isIsraeliMobile("+972545454562"), true);
  assert.equal(isIsraeliMobile("+97231234567"), false);
});
