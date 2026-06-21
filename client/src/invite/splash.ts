import { submitGuestNickname, type RedeemInviteResponse } from "./api.js";

export type InviteSplashResult =
  | { ok: true; token: string; address: string; lobbyRoomId: string }
  | { ok: false; error: string };

export function mountInviteSplash(
  app: HTMLElement,
  redeem: RedeemInviteResponse,
  opts?: {
    onSignIn?: () => void;
  }
): () => Promise<InviteSplashResult> {
  app.innerHTML = "";
  const root = document.createElement("div");
  root.className = "invite-splash";
  root.innerHTML = `
    <div class="invite-splash__card">
      <h1 class="invite-splash__title">Joining ${escapeHtml(redeem.hostDisplayName)}'s Match…</h1>
      <p class="invite-splash__hint">Pick a nickname — wallet sign-in is optional.</p>
      <label class="invite-splash__label">
        Nickname
        <input type="text" class="invite-splash__input" maxlength="24" autocomplete="nickname" />
      </label>
      <div class="invite-splash__actions">
        <button type="button" class="invite-splash__continue">Continue</button>
        <button type="button" class="invite-splash__signin">Sign in with wallet</button>
      </div>
      <p class="invite-splash__error" hidden></p>
    </div>
  `;
  app.appendChild(root);

  const input = root.querySelector<HTMLInputElement>(".invite-splash__input")!;
  input.value = redeem.suggestedNickname;

  const errEl = root.querySelector<HTMLParagraphElement>(".invite-splash__error")!;
  const continueBtn = root.querySelector<HTMLButtonElement>(".invite-splash__continue")!;
  const signInBtn = root.querySelector<HTMLButtonElement>(".invite-splash__signin")!;

  signInBtn.addEventListener("click", () => opts?.onSignIn?.());

  let resolveDone: (r: InviteSplashResult) => void;
  const done = new Promise<InviteSplashResult>((resolve) => {
    resolveDone = resolve;
  });

  continueBtn.addEventListener("click", async () => {
    errEl.hidden = true;
    continueBtn.disabled = true;
    try {
      const nickname = input.value.trim() || redeem.suggestedNickname;
      const result = await submitGuestNickname(redeem.token, nickname);
      resolveDone({
        ok: true,
        token: result.token,
        address: `guest:${redeem.guestId}`,
        lobbyRoomId: redeem.lobbyRoomId,
      });
    } catch (e) {
      errEl.textContent =
        e instanceof Error && e.message === "invalid_nickname"
          ? "Please choose a nickname (2–24 characters)."
          : "Could not join — try again.";
      errEl.hidden = false;
      continueBtn.disabled = false;
    }
  });

  return () => done;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
