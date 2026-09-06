import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendBasicTransactionWithDataViaPay } from "./sendBasicWithData.js";
import { utf8ToHex } from "./nimiqPayTxParams.js";

const sendBasicTransactionWithData = vi.fn();

vi.mock("@nimiq/mini-app-sdk", () => ({
  init: vi.fn(async () => ({ sendBasicTransactionWithData })),
}));

describe("sendBasicTransactionWithDataViaPay", () => {
  const memo = "NSPACE:pi:aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const recipient = "NQ07 0000 0000 0000 0000 0000 0000 0000 0000";

  beforeEach(() => {
    sendBasicTransactionWithData.mockReset();
    sendBasicTransactionWithData.mockResolvedValue("txhash");
    window.nimiqPay = undefined;
  });

  it("sends hex data and Hub extraData on the first Pay call", async () => {
    await sendBasicTransactionWithDataViaPay({
      recipient,
      amountLuna: 100000,
      memo,
    });
    expect(sendBasicTransactionWithData).toHaveBeenCalledTimes(1);
    expect(sendBasicTransactionWithData.mock.calls[0]![0]).toEqual({
      recipient,
      value: 100000,
      data: utf8ToHex(memo),
      extraData: memo,
      recipientData: utf8ToHex(memo),
    });
  });
});
