import assert from "node:assert/strict";
import test from "node:test";
import type { PlainTransactionDetails } from "@nimiq/core";
import { memoFromTransactionDetails } from "../src/nim/memo.js";

test("memoFromTransactionDetails decodes utf-8 from raw hex", () => {
  const memo = "NSPACE:pi:test-intent-id";
  const hex = Buffer.from(memo, "utf8").toString("hex");
  const details = {
    data: { type: "raw" as const, raw: hex },
  } as PlainTransactionDetails;
  assert.equal(memoFromTransactionDetails(details), memo);
});

test("memoFromTransactionDetails returns null for missing raw", () => {
  const details = { data: { type: "raw" as const, raw: "" } } as PlainTransactionDetails;
  assert.equal(memoFromTransactionDetails(details), null);
});
