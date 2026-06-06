import { apiUrl } from "../net/apiBase.js";
import {
  showUsernamePromptModal,
  showUsernamePromptStatusErrorModal,
} from "../ui/usernamePromptModal.js";
import type { UsernamePromptStatus } from "./nimiq.js";

function parseJwtSub(token: string): string {
  try {
    const p = String(token || "").split(".")[1] || "";
    if (!p) return "";
    const json = atob(p.replace(/-/g, "+").replace(/_/g, "/"));
    const obj = JSON.parse(json) as { sub?: string };
    return String(obj.sub || "");
  } catch {
    return "";
  }
}

async function fetchUsernamePromptStatus(token: string): Promise<UsernamePromptStatus> {
  const r = await fetch(apiUrl("/api/player-profile/username-prompt"), {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error("username_prompt_status_failed");
  const j = (await r.json()) as UsernamePromptStatus;
  if (typeof j.needsPrompt !== "boolean") {
    throw new Error("username_prompt_status_invalid");
  }
  return j;
}

async function putUsername(token: string, username: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await fetch(apiUrl("/api/player-profile/username"), {
    method: "PUT",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ username }),
  });
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) return { ok: false, error: String(j.error ?? "save_failed") };
  return { ok: true };
}

async function deferUsernamePrompt(
  token: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const r = await fetch(apiUrl("/api/player-profile/username/defer"), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) return { ok: false, error: String(j.error ?? "defer_failed") };
  return { ok: true };
}

async function loadUsernamePromptStatus(
  token: string,
  initial?: UsernamePromptStatus | null
): Promise<UsernamePromptStatus | null> {
  if (initial && typeof initial.needsPrompt === "boolean") {
    return initial;
  }
  for (;;) {
    try {
      return await fetchUsernamePromptStatus(token);
    } catch {
      const action = await showUsernamePromptStatusErrorModal();
      if (action === "cancel") return null;
    }
  }
}

/**
 * After wallet login or cached re-entry, prompt for a username when needed.
 * Always loads fresh status from the server (cached sessions do not skip the gate).
 * Returns true when the player may enter the game (saved, deferred, or no prompt).
 */
export async function runUsernamePromptGate(
  token: string,
  walletAddress?: string,
  initialStatus?: UsernamePromptStatus | null
): Promise<boolean> {
  const address =
    walletAddress?.replace(/\s+/g, "").trim() || parseJwtSub(token);

  const status = await loadUsernamePromptStatus(token, initialStatus);
  if (!status) return false;
  if (!status.needsPrompt) return true;

  for (;;) {
    const result = await showUsernamePromptModal({
      walletAddress: address || undefined,
      deferralsRemaining: status.deferralsRemaining,
      mustSetUsername: status.mustSetUsername,
      onSave: (username) => putUsername(token, username),
      onDefer: status.mustSetUsername
        ? undefined
        : () => deferUsernamePrompt(token),
    });

    if (result === "saved") return true;

    if (result === "deferred") {
      const afterDefer = await loadUsernamePromptStatus(token);
      if (!afterDefer) return false;
      return true;
    }

    if (result === "cancelled") {
      if (status.mustSetUsername) continue;
      return false;
    }
  }
}
