import { test } from "node:test";
import assert from "node:assert/strict";
import { evalExpr } from "./outcomeEval.js";

test("evalExpr: equality and booleans", () => {
  assert.equal(evalExpr("interested == true", { interested: true }), true);
  assert.equal(evalExpr("interested == true", { interested: false }), false);
});

test("evalExpr: && / || precedence", () => {
  const ctx = { a: true, b: false, c: true };
  assert.equal(evalExpr("a == true && c == true", ctx), true);
  assert.equal(evalExpr("a == true && b == true", ctx), false);
  assert.equal(evalExpr("b == true || c == true", ctx), true);
});

test("evalExpr: numeric comparison", () => {
  assert.equal(evalExpr("amount >= 1000", { amount: 5000 }), true);
  assert.equal(evalExpr("amount >= 1000", { amount: 500 }), false);
});

test("evalExpr: negation and parentheses", () => {
  assert.equal(evalExpr("!(a == false)", { a: true }), true);
  assert.equal(evalExpr("(a == true || b == true) && c == true", { a: false, b: true, c: true }), true);
});

test("evalExpr: missing key is falsy, not a crash", () => {
  assert.equal(evalExpr("ghost == true", {}), false);
});

test("evalExpr: malformed expression fails closed (false)", () => {
  assert.equal(evalExpr("interested == && ||", { interested: true }), false);
  assert.equal(evalExpr("", { interested: true }), false);
});
