import { validateBillboardHttpsTarget } from "./billboardAdvertsCatalog.js";
import {
  approveCampaign,
  applyCampaignTopUpPayment,
  adminUpdateCampaignFields,
  grantCampaignAdminCredit,
  expireCampaign,
  findCampaignByIntentId,
  getCampaignById,
  getCampaignForOwner,
  listCampaignsDueForExpiry,
  listCampaignsForOwner,
  markCampaignPendingApproval,
  rejectCampaign as rejectCampaignInStore,
  setCampaignPendingPayment,
  setCampaignTopUpPayment,
  type CampaignPublic,
} from "./campaignStore.js";
import {
  checkPaymentIntent,
  createBillboardSlotIntent,
  getPaymentIntent,
  isPaymentIntentClientConfigured,
} from "./paymentIntentClient.js";
import { removeCampaignFromAllRotationSets, listRotationSetIdsContainingCampaign } from "./rotationSetStore.js";
import {
  rebuildAllRotationBillboards,
  rebuildBillboardsForRotationSet,
} from "./rotationSetSync.js";
import { sendTelegramPlainText } from "./telegramNotify.js";

function normalizeWallet(v: string): string {
  return String(v || "").replace(/\s+/g, "").toUpperCase();
}

export async function createCampaignPaymentIntent(
  campaignId: string,
  ownerWallet: string,
  amountLuna?: bigint
): Promise<
  | { ok: true; campaign: CampaignPublic; intent: import("./paymentIntentClient.js").PublicPaymentIntent }
  | { ok: false; error: string }
> {
  if (!isPaymentIntentClientConfigured()) {
    return { ok: false, error: "payment_intent_not_configured" };
  }
  const campaign = getCampaignForOwner(campaignId, ownerWallet);
  if (!campaign) return { ok: false, error: "campaign_not_found" };
  const isTopUp = campaign.status === "approved";
  if (
    campaign.status !== "draft" &&
    campaign.status !== "pending_payment" &&
    campaign.status !== "expired" &&
    !isTopUp
  ) {
    return { ok: false, error: "campaign_not_payable" };
  }
  if (amountLuna === undefined) {
    return { ok: false, error: "amount_required" };
  }
  const quotedLuna = amountLuna;
  if (quotedLuna < 1n) {
    return { ok: false, error: "invalid_amount" };
  }
  const created = await createBillboardSlotIntent({
    payerWallet: normalizeWallet(ownerWallet),
    campaignId: campaign.id,
    idempotencyKey: isTopUp
      ? `campaign:${campaign.id}:topup:${quotedLuna.toString()}:${Date.now()}`
      : `campaign:${campaign.id}:${quotedLuna.toString()}`,
    amountLuna: quotedLuna,
  });
  if (!created.ok) {
    return { ok: false, error: created.error };
  }
  const updated = isTopUp
    ? setCampaignTopUpPayment(campaign.id, ownerWallet, created.intent.intentId)
    : setCampaignPendingPayment(campaign.id, ownerWallet, created.intent.intentId);
  if (!updated) return { ok: false, error: "campaign_update_failed" };
  return { ok: true, campaign: updated, intent: created.intent };
}

function notifyAdminCampaignPendingApproval(campaign: CampaignPublic): void {
  const lines = [
    "Billboard campaign — payment received",
    `Project: ${campaign.projectName}`,
    `Owner: ${campaign.ownerWallet}`,
    `Campaign: ${campaign.id}`,
    `Target: ${campaign.miniappTargetUrl}`,
    `Image: ${campaign.imageUrl}`,
    campaign.txHash ? `Tx: ${campaign.txHash}` : "",
    "Review and approve at /admin/campaign",
  ].filter(Boolean);
  void sendTelegramPlainText(lines.join("\n"), "campaign-approval");
}

async function confirmCampaignPaymentOnChain(
  campaign: CampaignPublic
): Promise<
  | { ok: true; campaign: CampaignPublic; txHash: string; amountLuna: bigint }
  | {
      ok: false;
      error: string;
      pending?: boolean;
      intentExpired?: boolean;
    }
> {
  if (!campaign.intentId) {
    return { ok: false, error: "campaign_missing_intent" };
  }
  if (!isPaymentIntentClientConfigured()) {
    return { ok: false, error: "payment_intent_not_configured" };
  }

  let intentStatus = await getPaymentIntent(campaign.intentId);
  if (!intentStatus.ok) {
    return {
      ok: false,
      error: intentStatus.error,
      pending: campaign.status === "pending_payment",
    };
  }
  const intentPhase = intentStatus.intent.status;
  if (intentPhase === "expired" || intentPhase === "failed") {
    return {
      ok: false,
      error:
        intentPhase === "expired"
          ? "payment_intent_expired"
          : "payment_intent_failed",
      pending: true,
      intentExpired: intentPhase === "expired",
    };
  }
  if (
    intentStatus.intent.status !== "confirmed" ||
    !intentStatus.intent.verifiedTxHash
  ) {
    const checked = await checkPaymentIntent(campaign.intentId);
    if (!checked.ok) {
      const checkedStatus = checked.intent?.status;
      const pending =
        checkedStatus === "pending" ||
        checkedStatus === "confirming" ||
        checkedStatus === "expired" ||
        checkedStatus === "failed" ||
        checked.error === "payment_not_confirmed" ||
        String(checked.error || "").indexOf("No matching payment") !== -1 ||
        String(checked.error || "").indexOf("not confirmed") !== -1 ||
        String(checked.error || "").indexOf("Intent TTL") !== -1 ||
        String(checked.error || "").indexOf("Intent not payable") !== -1 ||
        checked.error === "internal";
      return {
        ok: false,
        error:
          checkedStatus === "expired"
            ? "payment_intent_expired"
            : checkedStatus === "failed"
              ? "payment_intent_failed"
              : checked.error || "payment_not_confirmed",
        pending,
        intentExpired: checkedStatus === "expired",
      };
    }
    intentStatus = { ok: true, intent: checked.intent };
  }

  const intent = intentStatus.intent;
  if (intent.status !== "confirmed" || !intent.verifiedTxHash) {
    return { ok: false, error: "payment_not_confirmed", pending: true };
  }
  if (intent.featureKind !== "nspace.billboard.slot") {
    return { ok: false, error: "intent_wrong_feature" };
  }
  if (
    normalizeWallet(intent.payerWallet) !== normalizeWallet(campaign.ownerWallet)
  ) {
    return { ok: false, error: "intent_payer_mismatch" };
  }
  return {
    ok: true,
    campaign,
    txHash: intent.verifiedTxHash,
    amountLuna: BigInt(intent.amountLuna),
  };
}

/** Poll chain / payment-intent service; moves campaign to pending_approval when paid (or credits top-up on approved). */
export async function syncCampaignPaymentStatus(
  campaignId: string,
  ownerWallet: string
): Promise<
  | { ok: true; campaign: CampaignPublic; paymentPending?: boolean; topUpApplied?: boolean }
  | {
      ok: false;
      error: string;
      paymentPending?: boolean;
      intentExpired?: boolean;
    }
> {
  const campaign = getCampaignForOwner(campaignId, ownerWallet);
  if (!campaign) return { ok: false, error: "campaign_not_found" };
  if (campaign.status === "pending_approval") {
    return { ok: true, campaign };
  }
  if (campaign.status === "approved") {
    if (!campaign.intentId) {
      return { ok: true, campaign };
    }
    const confirmed = await confirmCampaignPaymentOnChain(campaign);
    if (!confirmed.ok) {
      return {
        ok: false,
        error: confirmed.error,
        paymentPending: confirmed.pending,
        intentExpired: confirmed.intentExpired,
      };
    }
    const toppedUp = applyCampaignTopUpPayment(
      campaign.id,
      confirmed.txHash,
      confirmed.amountLuna
    );
    if (!toppedUp) {
      const latest = getCampaignForOwner(campaignId, ownerWallet);
      if (latest?.status === "approved" && !latest.intentId) {
        return { ok: true, campaign: latest, topUpApplied: true };
      }
      return { ok: false, error: "top_up_failed" };
    }
    return { ok: true, campaign: toppedUp, topUpApplied: true };
  }
  if (campaign.status !== "pending_payment") {
    return { ok: false, error: "campaign_not_awaiting_payment" };
  }

  const confirmed = await confirmCampaignPaymentOnChain(campaign);
  if (!confirmed.ok) {
    return {
      ok: false,
      error: confirmed.error,
      paymentPending: confirmed.pending,
      intentExpired: confirmed.intentExpired,
    };
  }

  const pendingApproval = markCampaignPendingApproval(
    campaign.id,
    confirmed.txHash,
    confirmed.amountLuna
  );
  if (!pendingApproval) {
    const latest = getCampaignForOwner(campaignId, ownerWallet);
    if (latest?.status === "pending_approval") {
      return { ok: true, campaign: latest };
    }
    return { ok: false, error: "campaign_update_failed" };
  }
  notifyAdminCampaignPendingApproval(pendingApproval);
  return { ok: true, campaign: pendingApproval };
}

/** Admin approves a funded campaign — eligible for rotation sets (no auto placement). */
export async function approveCampaignForInGame(
  campaignId: string
): Promise<
  | { ok: true; campaign: CampaignPublic }
  | { ok: false; error: string }
> {
  const campaign = getCampaignById(campaignId);
  if (!campaign) return { ok: false, error: "campaign_not_found" };
  if (campaign.status === "approved") {
    return { ok: true, campaign };
  }
  if (campaign.status !== "pending_approval") {
    return { ok: false, error: "campaign_not_pending_approval" };
  }
  if (!campaign.txHash) {
    return { ok: false, error: "campaign_missing_tx" };
  }

  const approved = approveCampaign(campaign.id, null);
  if (!approved) {
    return { ok: false, error: "campaign_approval_failed" };
  }
  return { ok: true, campaign: approved };
}

export async function rejectCampaignForInGame(
  campaignId: string,
  note?: string
): Promise<
  | { ok: true; campaign: CampaignPublic }
  | { ok: false; error: string }
> {
  const campaign = getCampaignById(campaignId);
  if (!campaign) return { ok: false, error: "campaign_not_found" };
  if (campaign.status === "rejected") {
    return { ok: true, campaign };
  }
  if (campaign.status !== "pending_approval") {
    return { ok: false, error: "campaign_not_pending_approval" };
  }
  const rejected = rejectCampaignInStore(campaign.id, note);
  if (!rejected) return { ok: false, error: "campaign_reject_failed" };
  return { ok: true, campaign: rejected };
}

export function refreshRotationSetsAfterCampaignChange(
  campaignId: string
): number {
  const touched = removeCampaignFromAllRotationSets(campaignId);
  let rebuilt = 0;
  for (const setId of touched) {
    rebuilt += rebuildBillboardsForRotationSet(setId);
  }
  return rebuilt;
}

export async function syncOwnerCampaignsPaymentStatus(
  ownerWallet: string
): Promise<void> {
  const campaigns = listCampaignsForOwner(ownerWallet);
  for (const c of campaigns) {
    const awaitingPayment =
      (c.status === "pending_payment" || c.status === "approved") && c.intentId;
    if (!awaitingPayment) continue;
    try {
      await syncCampaignPaymentStatus(c.id, ownerWallet);
    } catch (e) {
      console.error("[campaigns] sync payment", c.id, e);
    }
  }
}

export function tickExpiredCampaignBillboards(nowMs: number): number {
  const due = listCampaignsDueForExpiry(nowMs);
  let expired = 0;
  for (const c of due) {
    removeCampaignFromAllRotationSets(c.id);
    expireCampaign(c.id);
    expired++;
  }
  if (expired > 0) {
    rebuildAllRotationBillboards();
  }
  return expired;
}

export function getCampaignByPaymentIntent(intentId: string): CampaignPublic | null {
  return findCampaignByIntentId(intentId);
}

export function rebuildRotationSetsAndBillboards(setIds: string[]): number {
  let rebuilt = 0;
  for (const setId of setIds) {
    rebuilt += rebuildBillboardsForRotationSet(setId);
  }
  return rebuilt;
}

export async function adminUpdateCampaignDetailsForInGame(
  campaignId: string,
  patch: { projectName?: string; miniappTargetUrl?: string }
): Promise<
  | { ok: true; campaign: CampaignPublic }
  | { ok: false; error: string }
> {
  const id = String(campaignId ?? "").trim();
  if (!id) return { ok: false, error: "campaign_not_found" };
  const existing = getCampaignById(id);
  if (!existing) return { ok: false, error: "campaign_not_found" };
  if (patch.projectName === undefined && patch.miniappTargetUrl === undefined) {
    return { ok: false, error: "no_fields" };
  }
  if (patch.projectName !== undefined) {
    const name = String(patch.projectName).trim();
    if (!name || name.length > 80) {
      return { ok: false, error: "invalid_project_name" };
    }
  }
  if (patch.miniappTargetUrl !== undefined) {
    if (!validateBillboardHttpsTarget(String(patch.miniappTargetUrl).trim())) {
      return { ok: false, error: "invalid_miniapp_target_url" };
    }
  }

  const updated = adminUpdateCampaignFields(id, patch);
  if (!updated) return { ok: false, error: "campaign_not_editable" };

  const setIds = listRotationSetIdsContainingCampaign(id);
  if (setIds.length) rebuildRotationSetsAndBillboards(setIds);
  return { ok: true, campaign: updated };
}

export async function grantCampaignAdminCreditForInGame(
  campaignId: string,
  amountLuna: bigint
): Promise<
  | { ok: true; campaign: CampaignPublic }
  | { ok: false; error: string }
> {
  const id = String(campaignId ?? "").trim();
  if (!id) return { ok: false, error: "campaign_not_found" };
  if (amountLuna < 1n) return { ok: false, error: "invalid_amount" };
  if (!getCampaignById(id)) return { ok: false, error: "campaign_not_found" };

  const updated = grantCampaignAdminCredit(id, amountLuna);
  if (!updated) return { ok: false, error: "campaign_not_creditable" };

  if (updated.status === "approved") {
    const setIds = listRotationSetIdsContainingCampaign(id);
    if (setIds.length) rebuildRotationSetsAndBillboards(setIds);
  }
  return { ok: true, campaign: updated };
}
