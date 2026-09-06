import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

test("advertise Nimiq Pay send attaches hex data and Hub extraData", () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "../src/advertisePage.ts"),
    "utf8"
  );
  assert.match(src, /tx\.data = hex/);
  assert.match(src, /tx\.extraData = memo/);
  assert.match(src, /tx\.recipientData = hex/);
  assert.match(src, /utf8ToHex\(memo\)/);
  assert.equal(src.includes("tx.data = opts.dataHex"), false);
  assert.equal(src.includes("tx.validityStartHeight"), false);
});
