import assert from "node:assert/strict";
import test from "node:test";
import { censorChat, isProfane } from "../src/profanityFilter.js";

test("censorChat leaves clean text unchanged", () => {
  const out = censorChat("hello world");
  assert.equal(out.wasFiltered, false);
  assert.equal(out.censored, "hello world");
  assert.equal(out.original, undefined);
});

test("censorChat replaces known profanity", () => {
  const out = censorChat("what the shit");
  assert.equal(out.wasFiltered, true);
  assert.ok(out.censored.includes("*"));
  assert.notEqual(out.censored, "what the shit");
  assert.equal(out.original, "what the shit");
});

test("censorChat blocks all-profanity messages via empty meaningful content", () => {
  const out = censorChat("shit");
  assert.equal(out.wasFiltered, true);
  assert.equal(out.censored.replace(/\*+/g, "").trim(), "");
});

test("isProfane catches custom list terms", () => {
  assert.equal(isProfane("you nimslut"), true);
});

test("censorChat allows innocent substring assassin", () => {
  assert.equal(isProfane("assassin"), false);
});
