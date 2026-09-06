import { describe, expect, it } from "vitest";
import {
  buildNimiqPaySendParams,
  utf8ToHex,
} from "./nimiqPayTxParams.js";

describe("buildNimiqPaySendParams", () => {
  const memo = "NSPACE:pi:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const recipient = "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";
  const value = 100000;

  it("attaches the memo so on-chain verify can match (hex data + Hub extraData)", () => {
    const tx = buildNimiqPaySendParams({ recipient, value, memo });
    const hex = utf8ToHex(memo);

    expect(tx.extraData).toBe(memo);
    expect(tx.data).toBe(hex);
    expect(tx.recipientData).toBe(hex);
    expect(Buffer.from(tx.data, "hex").toString("utf8")).toBe(memo);
    expect(tx.data).not.toBe(memo);
  });

  it("rejects an empty memo instead of sending an unverifiable payment", () => {
    expect(() =>
      buildNimiqPaySendParams({ recipient, value, memo: "  " })
    ).toThrow("missing_memo");
  });
});
