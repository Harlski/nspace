import assert from "node:assert/strict";
import test from "node:test";
import { formatRpcAddress, normalizeRpcTransactions } from "../src/nim/rpc.js";

test("formatRpcAddress groups compact Nimiq addresses", () => {
  assert.equal(
    formatRpcAddress("NQ162SSN82TLSMQSKXT3Q01VCMALNU6F1LJG"),
    "NQ16 2SSN 82TL SMQS KXT3 Q01V CMAL NU6F 1LJG"
  );
});

test("normalizeRpcTransactions accepts legacy array or wrapped data", () => {
  assert.equal(normalizeRpcTransactions([{ hash: "a" }]).length, 1);
  assert.equal(
    normalizeRpcTransactions({ data: [{ hash: "b" }] })[0]?.hash,
    "b"
  );
  assert.equal(normalizeRpcTransactions(null).length, 0);
});
