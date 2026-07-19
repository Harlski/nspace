import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLunaAsNimLabel,
  nimAmountToLuna,
  shortenWalletForSummary,
} from "./nimLuna.js";

test("nimAmountToLuna accepts decimals and whole NIM", () => {
  assert.equal(nimAmountToLuna("1"), 100_000n);
  assert.equal(nimAmountToLuna("0.01"), 1_000n);
  assert.equal(nimAmountToLuna("10"), 1_000_000n);
  assert.equal(nimAmountToLuna(""), null);
  assert.equal(nimAmountToLuna("0"), null);
  assert.equal(nimAmountToLuna("abc"), null);
});

test("formatLunaAsNimLabel round-trips common amounts", () => {
  assert.equal(formatLunaAsNimLabel(100_000n), "1");
  assert.equal(formatLunaAsNimLabel("1000"), "0.01");
  assert.equal(formatLunaAsNimLabel("1000000"), "10");
});

test("shortenWalletForSummary hides SYSTEM and blanks", () => {
  assert.equal(shortenWalletForSummary("SYSTEM"), "");
  assert.equal(shortenWalletForSummary(""), "");
  assert.equal(
    shortenWalletForSummary("NQ162SSN82TLSMQSKXT3Q01VCMALNU6F1LJG"),
    "NQ16…1LJG"
  );
});
