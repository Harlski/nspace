import { LUNA_PER_NIM } from "../payoutGateway.js";
import type { InvoiceRow } from "./store.js";

export type InvoicePublicJson = {
  invoiceId: string;
  to: string;
  amountNim: number;
  status: InvoiceRow["status"];
  returnBudgetNim: number;
  amountLuna: string;
  returnBudgetLuna: string;
};

function lunaToNimNumber(luna: string | bigint): number {
  const n = typeof luna === "bigint" ? luna : BigInt(luna);
  return Number(n / LUNA_PER_NIM);
}

export function invoiceToPublicJson(row: InvoiceRow): InvoicePublicJson {
  const remaining =
    row.status === "credited" ? BigInt(row.returnBudgetLuna) : 0n;
  return {
    invoiceId: row.invoiceId,
    to: row.toAddress,
    amountNim: lunaToNimNumber(row.amountLuna),
    status: row.status,
    returnBudgetNim: lunaToNimNumber(remaining),
    amountLuna: row.amountLuna,
    returnBudgetLuna: remaining.toString(),
  };
}
