import type { PlainTransactionDetails } from "@nimiq/core";

/**
 * Extract UTF-8 memo from recipient `data` when present as raw bytes (hex).
 */
export function memoFromTransactionDetails(details: PlainTransactionDetails): string | null {
  const data = details.data;
  if (!data || typeof data !== "object") return null;
  if ("type" in data && data.type === "raw" && "raw" in data) {
    const hex = String((data as { raw: string }).raw || "").trim();
    if (!hex) return null;
    try {
      return Buffer.from(hex, "hex").toString("utf8");
    } catch {
      return null;
    }
  }
  return null;
}
