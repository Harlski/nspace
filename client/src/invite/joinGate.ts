import { completeWalletPayloadAuthWithTermsPrivacyRetry } from "../auth/authTermsPrivacyVerify.js";
import { signInWithWallet } from "../auth/nimiq.js";
import {
  listCachedSessions,
  MAIN_SITE_MAX_CACHED_ACCOUNTS,
  saveCachedSession,
  isTokenExpired,
} from "../auth/session.js";
import { formatWalletAddressGap4 } from "../formatWalletAddress.js";
import { identiconDataUrl } from "../game/identiconTexture.js";
import { nimiqLogosHexOutlineMonoPlusMarkup } from "../ui/nimiqIcons.js";
import {
  joinInviteAsWallet,
  peekDirectInvite,
  redeemDirectInvite,
  submitGuestNickname,
  type PeekInviteResponse,
} from "./api.js";
import { mountGuestPlaySpaceClosedOnboarding } from "./walletOnboarding.js";

export type JoinGateResult =
  | {
      ok: true;
      token: string;
      address: string;
      lobbyRoomId: string;
      walletToken?: string;
      walletAddress?: string;
      nimiqPay?: boolean;
    }
  | { ok: false; error: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function joinGateTitle(hostDisplayName: string): string {
  return `Join ${hostDisplayName}'s Nimiq Space`;
}

function validCachedSessions() {
  return listCachedSessions()
    .filter((e) => !isTokenExpired(e.token))
    .slice(0, MAIN_SITE_MAX_CACHED_ACCOUNTS);
}

function peekErrorMessage(peek: PeekInviteResponse): string {
  switch (peek.error) {
    case "expired":
      return "This invite has expired - ask the host for a new link.";
    case "full":
      return "This play space is full.";
    case "closed":
      return "This play space has closed.";
    case "not_found":
      return "This invite link has expired or is no longer valid.";
    default:
      return "This invite link has expired or is no longer valid.";
  }
}

export function mountJoinGate(app: HTMLElement, slug: string): () => Promise<JoinGateResult> {
  app.innerHTML = "";
  const root = document.createElement("div");
  root.className = "invite-splash join-gate";
  root.innerHTML = `
    <div class="invite-splash__card join-gate__card">
      <header class="join-gate__brand">
        <h1 class="main-menu__title join-gate__brand-title">
          <span class="main-menu__title-nimiq">NIMIQ</span>
          <span class="main-menu__title-space">SPACE</span>
        </h1>
      </header>
      <h2 class="invite-splash__title join-gate__title"></h2>
      <p class="invite-splash__hint join-gate__hint"></p>
      <div class="join-gate__body"></div>
      <p class="invite-splash__error join-gate__error" hidden></p>
    </div>
  `;
  app.appendChild(root);

  const titleEl = root.querySelector<HTMLElement>(".join-gate__title")!;
  const hintEl = root.querySelector<HTMLElement>(".join-gate__hint")!;
  const bodyEl = root.querySelector<HTMLElement>(".join-gate__body")!;
  const errEl = root.querySelector<HTMLElement>(".join-gate__error")!;

  let resolveDone: (r: JoinGateResult) => void;
  const done = new Promise<JoinGateResult>((resolve) => {
    resolveDone = resolve;
  });

  let peek: PeekInviteResponse | null = null;
  let busy = false;

  const showErr = (message: string): void => {
    errEl.textContent = message;
    errEl.hidden = false;
  };

  const clearErr = (): void => {
    errEl.hidden = true;
  };

  const setBusy = (on: boolean): void => {
    busy = on;
    root.querySelectorAll("button").forEach((b) => {
      (b as HTMLButtonElement).disabled = on;
    });
  };

  const finishWalletJoin = async (
    walletToken: string,
    walletAddress: string,
    nimiqPay?: boolean
  ): Promise<void> => {
    clearErr();
    setBusy(true);
    try {
      const joined = await joinInviteAsWallet(slug, walletToken);
      saveCachedSession(walletToken, walletAddress, nimiqPay);
      resolveDone({
        ok: true,
        token: joined.token,
        address: joined.address,
        lobbyRoomId: joined.lobbyRoomId,
        walletToken,
        walletAddress,
        nimiqPay,
      });
    } catch (e) {
      showErr(
        e instanceof Error && e.message === "full"
          ? "This play space is full."
          : "Could not join - try again."
      );
      setBusy(false);
    }
  };

  const runWalletSignIn = async (): Promise<void> => {
    if (busy) return;
    clearErr();
    setBusy(true);
    try {
      const verified = await completeWalletPayloadAuthWithTermsPrivacyRetry((nonce) =>
        signInWithWallet(nonce)
      );
      await finishWalletJoin(verified.token, verified.address, verified.nimiqPay);
    } catch (e) {
      showErr(e instanceof Error ? e.message : "login_failed");
      setBusy(false);
    }
  };

  const renderGuestForm = (
    guestId: string,
    suggestedNickname: string,
    guestToken: string,
    lobbyRoomId: string
  ): void => {
    bodyEl.innerHTML = `
      <div class="join-gate__guest">
        <img class="join-gate__guest-identicon" alt="" width="72" height="72" />
        <label class="invite-splash__label join-gate__nickname-label">
          Nickname
          <input type="text" class="invite-splash__input join-gate__nickname" maxlength="24" autocomplete="nickname" />
        </label>
        <button type="button" class="invite-splash__continue join-gate__enter">Enter game</button>
        <button type="button" class="join-gate__back">Go back</button>
      </div>
    `;
    hintEl.textContent = "Pick a nickname for this visit.";
    const iconEl = bodyEl.querySelector<HTMLImageElement>(".join-gate__guest-identicon")!;
    void identiconDataUrl(guestId).then((url) => {
      iconEl.src = url;
    });
    const input = bodyEl.querySelector<HTMLInputElement>(".join-gate__nickname")!;
    input.value = suggestedNickname;
    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });
    bodyEl.querySelector<HTMLButtonElement>(".join-gate__enter")!.addEventListener("click", async () => {
      if (busy) return;
      clearErr();
      setBusy(true);
      try {
        const nickname = input.value.trim() || suggestedNickname;
        const result = await submitGuestNickname(guestToken, nickname);
        resolveDone({
          ok: true,
          token: result.token,
          address: `guest:${guestId}`,
          lobbyRoomId,
        });
      } catch (e) {
        showErr(
          e instanceof Error && e.message === "invalid_nickname"
            ? "Please choose a nickname (2–24 characters)."
            : "Could not join - try again."
        );
        setBusy(false);
      }
    });
    bodyEl.querySelector<HTMLButtonElement>(".join-gate__back")!.addEventListener("click", () => {
      if (busy) return;
      clearErr();
      renderIdentity();
    });
  };

  const startGuestPath = async (): Promise<void> => {
    if (busy) return;
    clearErr();
    setBusy(true);
    try {
      const redeem = await redeemDirectInvite(slug);
      setBusy(false);
      renderGuestForm(redeem.guestId, redeem.suggestedNickname, redeem.token, redeem.lobbyRoomId);
    } catch (e) {
      showErr(
        e instanceof Error && e.message === "full"
          ? "This play space is full."
          : "Could not join - try again."
      );
      setBusy(false);
    }
  };

  const renderAccountFirst = (): void => {
    const sessions = validCachedSessions();
    bodyEl.innerHTML = `
      <div class="join-gate__accounts" role="list"></div>
      <button type="button" class="join-gate__guest-link">Continue as guest</button>
    `;
    hintEl.textContent = "Choose an account or continue without a wallet.";
    const listEl = bodyEl.querySelector<HTMLElement>(".join-gate__accounts")!;
    for (const entry of sessions) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "join-gate__account-row";
      row.setAttribute("role", "listitem");
      row.title = entry.address;
      const img = document.createElement("img");
      img.className = "join-gate__account-identicon";
      img.alt = "";
      img.width = 48;
      img.height = 48;
      const label = document.createElement("span");
      label.className = "join-gate__account-label mono";
      label.textContent = formatWalletAddressGap4(entry.address);
      row.appendChild(img);
      row.appendChild(label);
      void identiconDataUrl(entry.address).then((url) => {
        img.src = url;
      });
      row.addEventListener("click", () => {
        if (busy) return;
        void finishWalletJoin(entry.token, entry.address, entry.nimiqPay);
      });
      listEl.appendChild(row);
    }
    const addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.className = "join-gate__account-row join-gate__account-row--add";
    addBtn.setAttribute("role", "listitem");
    addBtn.setAttribute("aria-label", "Add account - sign in with wallet");
    addBtn.innerHTML = `<span class="join-gate__add-icon">${nimiqLogosHexOutlineMonoPlusMarkup()}</span><span>Add account</span>`;
    addBtn.addEventListener("click", () => void runWalletSignIn());
    listEl.appendChild(addBtn);

    bodyEl.querySelector<HTMLButtonElement>(".join-gate__guest-link")!.addEventListener("click", () => {
      void startGuestPath();
    });
  };

  const renderFork = (): void => {
    bodyEl.innerHTML = `
      <div class="invite-splash__actions join-gate__fork">
        <button type="button" class="invite-splash__signin join-gate__signin">Sign in with wallet</button>
        <button type="button" class="invite-splash__continue join-gate__guest-btn">Continue as guest</button>
      </div>
    `;
    hintEl.textContent = "Sign in with your wallet or continue as a guest.";
    bodyEl.querySelector<HTMLButtonElement>(".join-gate__signin")!.addEventListener("click", () => {
      void runWalletSignIn();
    });
    bodyEl.querySelector<HTMLButtonElement>(".join-gate__guest-btn")!.addEventListener("click", () => {
      void startGuestPath();
    });
  };

  const renderIdentity = (): void => {
    if (!peek?.hostDisplayName) return;
    titleEl.textContent = joinGateTitle(peek.hostDisplayName);
    if (validCachedSessions().length > 0) renderAccountFirst();
    else renderFork();
  };

  const renderBlocked = (heading: string, message: string): void => {
    mountGuestPlaySpaceClosedOnboarding(app, {
      title: heading,
      message,
      onWebWallet: () => {
        window.location.assign("/");
      },
    });
  };

  void (async () => {
    try {
      peek = await peekDirectInvite(slug);
      if (!peek.joinable) {
        renderBlocked("Cannot join", peekErrorMessage(peek));
        return;
      }
      renderIdentity();
    } catch {
      renderBlocked("Cannot join", "This invite link has expired or is no longer valid.");
    }
  })();

  return () => done;
}
