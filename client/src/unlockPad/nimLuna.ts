/** 1 NIM = 100_000 luna (Nimiq 5 decimal places). */
export const LUNA_PER_NIM = 100_000n;

/** Parse a NIM amount string into luna. Returns null if invalid or &lt; 1 luna. */
export function nimAmountToLuna(nim: string): bigint | null {
  let t = String(nim ?? "")
    .trim()
    .replace(/,/g, ".");
  t = t.replace(/[^\d.]/g, "");
  const dot = t.indexOf(".");
  if (dot >= 0) {
    t = t.slice(0, dot + 1) + t.slice(dot + 1).replace(/\./g, "");
  }
  if (t.endsWith(".")) t = t.slice(0, -1);
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const parts = t.split(".");
  const whole = BigInt(parts[0] ?? "0");
  const frac = (parts[1] ?? "").padEnd(5, "0").slice(0, 5);
  const luna = whole * LUNA_PER_NIM + BigInt(frac);
  return luna < 1n ? null : luna;
}

/** Human-readable NIM label from luna (no trailing junk). */
export function formatLunaAsNimLabel(luna: bigint | string): string {
  const raw =
    typeof luna === "bigint" ? luna.toString() : String(luna ?? "").trim();
  if (!/^\d+$/.test(raw)) return "";
  const n = BigInt(raw);
  if (n < 1n) return "";
  const nimWhole = n / LUNA_PER_NIM;
  const rem = n % LUNA_PER_NIM;
  if (rem === 0n) return String(nimWhole);
  const frac = rem.toString().padStart(5, "0").replace(/0+$/, "");
  return `${nimWhole}.${frac}`;
}

export function shortenWalletForSummary(addr: string): string {
  const a = String(addr ?? "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
  if (!a || a === "SYSTEM") return "";
  if (a.length <= 12) return a;
  return `${a.slice(0, 4)}…${a.slice(-4)}`;
}
