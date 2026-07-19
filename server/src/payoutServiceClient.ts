/**
 * HTTP client for the Payout Service sidecar.
 */

export type PayIntent = {
  claimId: string;
  recipientAddress: string;
  amountLuna?: bigint;
  roomId: string;
  tileKey: string;
  txMessage?: string;
};

export type PayIntentPayload = PayIntent;

export function normalizePayoutServiceBaseUrl(
  raw: string | undefined | null
): string | null {
  const t = String(raw ?? "").trim();
  if (!t) return null;
  return t.replace(/\/+$/, "");
}

export function getPayoutServiceBaseUrl(): string | null {
  return normalizePayoutServiceBaseUrl(process.env.PAYOUT_SERVICE_URL);
}

function apiSecret(): string | null {
  const s = process.env.PAYOUT_SERVICE_API_SECRET?.trim();
  return s || null;
}

export function isPayoutServiceClientConfigured(): boolean {
  return getPayoutServiceBaseUrl() != null && apiSecret() != null;
}

/** Default fetch budget for quick payout-service reads (balance, snapshots). */
const PAYOUT_FETCH_DEFAULT_TIMEOUT_MS = 12_000;

/** On-chain send + inclusion poll can exceed the default; match sidecar confirm budget. */
export function payoutSendFetchTimeoutMs(): number {
  const confirmMs = Number(process.env.NIM_TX_CONFIRM_TIMEOUT_MS ?? 120_000);
  const safeConfirm =
    Number.isFinite(confirmMs) && confirmMs > 0 ? confirmMs : 120_000;
  return Math.max(PAYOUT_FETCH_DEFAULT_TIMEOUT_MS, safeConfirm + 15_000);
}

async function payoutFetch(
  path: string,
  init: RequestInit,
  opts?: { timeoutMs?: number }
): Promise<{ ok: boolean; status: number; json: unknown | null; text: string }> {
  const base = getPayoutServiceBaseUrl();
  const secret = apiSecret();
  if (!base || !secret) {
    return {
      ok: false,
      status: 0,
      json: null,
      text: "payout_service_not_configured",
    };
  }
  const url = `${normalizePayoutServiceBaseUrl(base)}${path}`;
  const timeoutMs = opts?.timeoutMs ?? PAYOUT_FETCH_DEFAULT_TIMEOUT_MS;
  try {
    const res = await fetch(url, {
      ...init,
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
        ...(init.headers as Record<string, string> | undefined),
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await res.text();
    let json: unknown | null = null;
    try {
      json = JSON.parse(text) as unknown;
    } catch {
      json = null;
    }
    return { ok: res.ok, status: res.status, json, text };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, status: 0, json: null, text: msg };
  }
}

export async function deliverPayIntentToService(
  intent: PayIntentPayload
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const body: Record<string, string> = {
    claimId: intent.claimId,
    recipientAddress: intent.recipientAddress,
    roomId: intent.roomId,
    tileKey: intent.tileKey,
  };
  if (intent.amountLuna !== undefined) {
    body.amountLuna = intent.amountLuna.toString();
  }
  if (intent.txMessage?.trim()) {
    body.txMessage = intent.txMessage.trim();
  }

  const r = await payoutFetch("/v1/pay-intents", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    return {
      ok: false,
      error: r.text || `HTTP ${r.status}`,
      status: r.status || undefined,
    };
  }

  if (r.json && typeof r.json === "object" && r.json !== null) {
    const accepted = (r.json as Record<string, unknown>).accepted;
    if (accepted === true) {
      return { ok: true };
    }
  }

  return { ok: false, error: "invalid_response", status: r.status };
}

export async function fetchBalanceFromService(): Promise<
  { ok: true; balanceLuna: bigint } | { ok: false; error: string; status?: number }
> {
  const r = await payoutFetch("/v1/balance", { method: "GET" });
  if (!r.ok) {
    return {
      ok: false,
      error: r.text || `HTTP ${r.status}`,
      status: r.status || undefined,
    };
  }
  if (r.json && typeof r.json === "object" && r.json !== null) {
    const raw = (r.json as Record<string, unknown>).balanceLuna;
    if (typeof raw === "string" && /^\d+$/.test(raw)) {
      return { ok: true, balanceLuna: BigInt(raw) };
    }
  }
  return { ok: false, error: "invalid_response", status: r.status };
}

export type PayIntentDeliverer = (
  intent: PayIntentPayload
) => Promise<{ ok: true } | { ok: false; error: string; status?: number }>;

export type PendingPayoutQueueTotals = {
  jobCount: number;
  recipientCount: number;
  totalLuna: string;
  totalNim: string;
};

export type PublicPendingPayoutRow = {
  time: string;
  identicon: string;
  walletId: string;
  /** Custom username or wallet shorthand when enriched by the game server. */
  displayName?: string;
  amountNim: string;
};

export type PublicPayoutHistoryRow = {
  time: string;
  identicon: string;
  walletId: string;
  displayName?: string;
  amountNim: string;
  txHash: string;
};

export type PendingByRecipientSummaryRow = {
  walletId: string;
  displayName?: string;
  jobCount: number;
  amountLuna: string;
  amountNim: string;
};

export type ManualBulkPayoutHistoryRow = {
  time: string;
  walletId: string;
  displayName?: string;
  amountNim: string;
  jobsCleared: number;
  state: string;
  txHash: string;
  txMessage: string;
};

export type PublicPendingPayoutSnapshot = {
  allSent: boolean;
  pendingTotal: number;
  message: string | null;
  rows: PublicPendingPayoutRow[];
  historyRows: PublicPayoutHistoryRow[];
  pendingByRecipient?: PendingByRecipientSummaryRow[];
  manualBulkHistory?: ManualBulkPayoutHistoryRow[];
};

export type PublicPendingPayoutSummary = {
  mode: "summary";
  pendingTotal: number;
  processedToday: number;
  allSent: boolean;
  message: string | null;
};

export type WalletPendingPayoutDetail = PublicPendingPayoutSnapshot & {
  mode: "wallet";
  processedToday: number;
};

export type FlushAllPendingPayoutsResult = {
  recipientsAttempted: number;
  recipientsPaid: number;
  jobsCleared: number;
  totalLuna: string;
  totalNim: string;
  failures: { walletId: string; error: string }[];
  skippedNotConfigured: boolean;
};

type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

async function parseServiceJson<T>(
  r: Awaited<ReturnType<typeof payoutFetch>>,
  validate: (json: unknown) => T | null
): Promise<ServiceResult<T>> {
  if (!r.ok) {
    return {
      ok: false,
      error: r.text || `HTTP ${r.status}`,
      status: r.status || undefined,
    };
  }
  const data = validate(r.json);
  if (data === null) {
    return { ok: false, error: "invalid_response", status: r.status };
  }
  return { ok: true, data };
}

function parsePendingTotals(json: unknown): PendingPayoutQueueTotals | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (
    typeof o.jobCount !== "number" ||
    typeof o.recipientCount !== "number" ||
    typeof o.totalLuna !== "string" ||
    typeof o.totalNim !== "string"
  ) {
    return null;
  }
  return {
    jobCount: o.jobCount,
    recipientCount: o.recipientCount,
    totalLuna: o.totalLuna,
    totalNim: o.totalNim,
  };
}

function parsePublicSummary(json: unknown): PublicPendingPayoutSummary | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (
    o.mode !== "summary" ||
    typeof o.pendingTotal !== "number" ||
    typeof o.processedToday !== "number" ||
    typeof o.allSent !== "boolean" ||
    (o.message !== null && typeof o.message !== "string")
  ) {
    return null;
  }
  return {
    mode: "summary",
    pendingTotal: o.pendingTotal,
    processedToday: o.processedToday,
    allSent: o.allSent,
    message: o.message as string | null,
  };
}

function parseSnapshot(json: unknown): PublicPendingPayoutSnapshot | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (
    typeof o.allSent !== "boolean" ||
    typeof o.pendingTotal !== "number" ||
    (o.message !== null && typeof o.message !== "string") ||
    !Array.isArray(o.rows) ||
    !Array.isArray(o.historyRows)
  ) {
    return null;
  }
  return json as PublicPendingPayoutSnapshot;
}

function parseWalletSnapshot(json: unknown): WalletPendingPayoutDetail | null {
  const snap = parseSnapshot(json);
  if (!snap || typeof json !== "object" || json === null) return null;
  const o = json as Record<string, unknown>;
  if (o.mode !== "wallet" || typeof o.processedToday !== "number") return null;
  return { ...snap, mode: "wallet", processedToday: o.processedToday };
}

function parseFlushResult(json: unknown): FlushAllPendingPayoutsResult | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (
    typeof o.recipientsAttempted !== "number" ||
    typeof o.recipientsPaid !== "number" ||
    typeof o.jobsCleared !== "number" ||
    typeof o.totalLuna !== "string" ||
    typeof o.totalNim !== "string" ||
    typeof o.skippedNotConfigured !== "boolean" ||
    !Array.isArray(o.failures)
  ) {
    return null;
  }
  return json as FlushAllPendingPayoutsResult;
}

function parseManualBulkResult(
  json: unknown
): { txHash: string; jobsCleared: number; totalLuna: string } | null {
  if (!json || typeof json !== "object") return null;
  const o = json as Record<string, unknown>;
  if (
    typeof o.txHash !== "string" ||
    typeof o.jobsCleared !== "number" ||
    typeof o.totalLuna !== "string"
  ) {
    return null;
  }
  return {
    txHash: o.txHash,
    jobsCleared: o.jobsCleared,
    totalLuna: o.totalLuna,
  };
}

export async function fetchPendingQueueTotalsFromService(): Promise<
  ServiceResult<PendingPayoutQueueTotals>
> {
  const r = await payoutFetch("/v1/pending/totals", { method: "GET" });
  return parseServiceJson(r, parsePendingTotals);
}

export async function fetchPublicPendingSummaryFromService(): Promise<
  ServiceResult<PublicPendingPayoutSummary>
> {
  const r = await payoutFetch("/v1/pending/summary", { method: "GET" });
  return parseServiceJson(r, parsePublicSummary);
}

export async function fetchPendingSnapshotFromService(opts?: {
  wallet?: string;
  adminPanel?: boolean;
}): Promise<ServiceResult<PublicPendingPayoutSnapshot | WalletPendingPayoutDetail>> {
  const params = new URLSearchParams();
  if (opts?.wallet?.trim()) params.set("wallet", opts.wallet.trim());
  if (opts?.adminPanel) params.set("adminPanel", "1");
  const qs = params.toString();
  const path = qs ? `/v1/pending/snapshot?${qs}` : "/v1/pending/snapshot";
  const r = await payoutFetch(path, { method: "GET" });
  if (!r.ok) {
    return {
      ok: false,
      error: r.text || `HTTP ${r.status}`,
      status: r.status || undefined,
    };
  }
  if (opts?.wallet?.trim()) {
    const data = parseWalletSnapshot(r.json);
    if (!data) return { ok: false, error: "invalid_response", status: r.status };
    return { ok: true, data };
  }
  const data = parseSnapshot(r.json);
  if (!data) return { ok: false, error: "invalid_response", status: r.status };
  return { ok: true, data };
}

export async function triggerManualBulkPayoutViaService(
  recipient: string
): Promise<
  ServiceResult<{ txHash: string; jobsCleared: number; totalLuna: string }>
> {
  const r = await payoutFetch(
    "/v1/manual-bulk-payout",
    {
      method: "POST",
      body: JSON.stringify({ recipient }),
    },
    { timeoutMs: payoutSendFetchTimeoutMs() }
  );
  return parseServiceJson(r, parseManualBulkResult);
}

export async function triggerEndOfDayFlushViaService(): Promise<
  ServiceResult<FlushAllPendingPayoutsResult>
> {
  const r = await payoutFetch(
    "/v1/flush",
    { method: "POST", body: "{}" },
    { timeoutMs: payoutSendFetchTimeoutMs() }
  );
  return parseServiceJson(r, parseFlushResult);
}

export type PayoutSentHistoryRow = {
  sentAt: number;
  enqueuedAt: number;
  recipient: string;
  amountLuna: string;
  txHash: string;
  claimId: string;
  roomId: string;
  tileKey: string;
  jobId?: string;
  state?: string;
  manualBulk?: boolean;
  bulkTotalLuna?: string;
};

function parseSentHistoryRows(json: unknown): PayoutSentHistoryRow[] | null {
  if (!json || typeof json !== "object") return null;
  const rows = (json as Record<string, unknown>).rows;
  if (!Array.isArray(rows)) return null;
  const out: PayoutSentHistoryRow[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    if (
      typeof o.sentAt !== "number" ||
      typeof o.enqueuedAt !== "number" ||
      typeof o.recipient !== "string" ||
      typeof o.amountLuna !== "string" ||
      !/^\d+$/.test(o.amountLuna) ||
      typeof o.txHash !== "string" ||
      !o.txHash ||
      typeof o.claimId !== "string" ||
      !o.claimId ||
      typeof o.roomId !== "string" ||
      typeof o.tileKey !== "string"
    ) {
      continue;
    }
    out.push({
      sentAt: o.sentAt,
      enqueuedAt: o.enqueuedAt,
      recipient: o.recipient,
      amountLuna: o.amountLuna,
      txHash: o.txHash,
      claimId: o.claimId,
      roomId: o.roomId,
      tileKey: o.tileKey,
      jobId: typeof o.jobId === "string" ? o.jobId : undefined,
      state: typeof o.state === "string" ? o.state : undefined,
      manualBulk: o.manualBulk === true,
      bulkTotalLuna:
        typeof o.bulkTotalLuna === "string" ? o.bulkTotalLuna : undefined,
    });
  }
  return out;
}

export async function fetchSentHistoryFromService(opts?: {
  sinceMs?: number;
  limit?: number;
}): Promise<
  ServiceResult<PayoutSentHistoryRow[]>
> {
  const sinceMs = Math.max(0, Math.floor(opts?.sinceMs ?? 0));
  const limit = Math.min(5000, Math.max(1, Math.floor(opts?.limit ?? 500)));
  const params = new URLSearchParams({
    since: String(sinceMs),
    limit: String(limit),
  });
  const r = await payoutFetch(`/v1/sent-history?${params.toString()}`, {
    method: "GET",
  });
  return parseServiceJson(r, parseSentHistoryRows);
}
