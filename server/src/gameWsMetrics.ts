/**
 * Optional WebSocket traffic stats (bytes + send counts by message `type`).
 *
 * Enable periodic logs with `WS_METRICS_INTERVAL_MS` (e.g. `10000` = every 10s).
 * If unset or `0`, logging is off. Applies to the game socket handled in `rooms.ts`.
 */

const intervalMs = Math.max(
  0,
  Math.floor(Number(process.env.WS_METRICS_INTERVAL_MS ?? "0"))
);

/** UTF-8 byte length of an inbound WebSocket payload (game JSON is text). */
export function utf8ByteLengthOfWsData(raw: unknown): number {
  if (typeof raw === "string") return Buffer.byteLength(raw, "utf8");
  if (Buffer.isBuffer(raw)) return raw.length;
  if (raw instanceof ArrayBuffer) return raw.byteLength;
  if (ArrayBuffer.isView(raw)) return raw.byteLength;
  try {
    return Buffer.byteLength(String(raw), "utf8");
  } catch {
    return 0;
  }
}

let outBytesByType = new Map<string, number>();
let outSendsByType = new Map<string, number>();
let inBytesByType = new Map<string, number>();
let inMsgsByType = new Map<string, number>();

let started = false;

export function recordGameWsOutbound(
  type: string,
  payloadUtf8Bytes: number,
  recipientCount: number
): void {
  if (intervalMs <= 0 || recipientCount <= 0 || payloadUtf8Bytes <= 0) return;
  const wire = payloadUtf8Bytes * recipientCount;
  outBytesByType.set(type, (outBytesByType.get(type) ?? 0) + wire);
  outSendsByType.set(type, (outSendsByType.get(type) ?? 0) + recipientCount);
}

export function recordGameWsInbound(type: string, rawUtf8Bytes: number): void {
  if (intervalMs <= 0 || rawUtf8Bytes <= 0) return;
  inBytesByType.set(type, (inBytesByType.get(type) ?? 0) + rawUtf8Bytes);
  inMsgsByType.set(type, (inMsgsByType.get(type) ?? 0) + 1);
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KiB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MiB`;
}

function flushLog(): void {
  if (intervalMs <= 0) return;

  const outRows = [...outBytesByType.entries()]
    .map(([type, bytes]) => ({
      type,
      bytes,
      sends: outSendsByType.get(type) ?? 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  const inRows = [...inBytesByType.entries()]
    .map(([type, bytes]) => ({
      type,
      bytes,
      msgs: inMsgsByType.get(type) ?? 0,
    }))
    .sort((a, b) => b.bytes - a.bytes);

  outBytesByType = new Map();
  outSendsByType = new Map();
  inBytesByType = new Map();
  inMsgsByType = new Map();

  const outTotal = outRows.reduce((s, r) => s + r.bytes, 0);
  const inTotal = inRows.reduce((s, r) => s + r.bytes, 0);

  if (outTotal === 0 && inTotal === 0) return;

  console.log(
    `[ws-metrics] window=${intervalMs}ms outbound_wire=${formatBytes(outTotal)} inbound_raw=${formatBytes(inTotal)}`
  );
  if (outRows.length) {
    console.log(
      `[ws-metrics] out (type → wire, sends): ${outRows
        .map((r) => `${r.type} ${formatBytes(r.bytes)} ${r.sends}`)
        .join(" | ")}`
    );
  }
  if (inRows.length) {
    console.log(
      `[ws-metrics] in (type → bytes, msgs): ${inRows
        .map((r) => `${r.type} ${formatBytes(r.bytes)} ${r.msgs}`)
        .join(" | ")}`
    );
  }
}

/** Call once from server startup when `rooms` is active. No-op if interval is 0. */
export function startGameWsMetricsFlushTimer(): void {
  if (started || intervalMs <= 0) return;
  started = true;
  setInterval(flushLog, intervalMs);
}
