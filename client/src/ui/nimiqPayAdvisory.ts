import telegramIconUrl from "../assets/social/telegram.svg?url";
import xIconUrl from "../assets/social/x.svg?url";
import { TELEGRAM_URL, X_URL } from "../socialLinks.js";

const NIMIQ_SPACE_URL = "https://nimiq.space/";

const COPY_TIP_MS = 6500;

const COPY_TIP_OK =
  "Link copied — paste the address into a browser (for example Google Chrome) to open Nimiq Space.";

const COPY_TIP_FAIL =
  "Could not copy automatically — select the address and copy it, then open a browser and paste.";

async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/**
 * Advisory after server-confirmed Nimiq Pay login. Shown on every sign-in until dismissed.
 * Returns a disposer that removes the overlay (e.g. when leaving the game).
 */
export function mountNimiqPaySiteAdvisory(host: HTMLElement): () => void {
  const root = document.createElement("div");
  root.className = "nimiq-pay-advisory";
  root.innerHTML = `
    <div class="nimiq-pay-advisory__backdrop" aria-hidden="true"></div>
    <div
      class="nimiq-pay-advisory__dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="nimiq-pay-advisory-title"
    >
      <h2 class="nimiq-pay-advisory__title" id="nimiq-pay-advisory-title">Nimiq Pay</h2>
      <p class="nimiq-pay-advisory__body" id="nimiq-pay-advisory-body">
        Nimiq Space is best experienced on
        <span class="nimiq-pay-advisory__link-wrap">
          <a
            class="nimiq-pay-advisory__link"
            id="nimiq-pay-advisory-site-link"
            href="${NIMIQ_SPACE_URL}"
            rel="noopener noreferrer"
            aria-label="Copy https://nimiq.space to clipboard"
            title="Tap to copy link"
          >https://nimiq.space</a>
          <span
            class="nimiq-pay-advisory__copy-tip"
            id="nimiq-pay-advisory-copy-tip"
            role="status"
            aria-live="polite"
            hidden
          ></span>
        </span>.
        The Nimiq Pay application is not yet fully supported.
      </p>
      <div class="nimiq-pay-advisory__actions">
        <a
          class="nimiq-pay-advisory__social"
          href="${TELEGRAM_URL}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img class="nimiq-pay-advisory__social-icon" src="${telegramIconUrl}" alt="" width="18" height="18" aria-hidden="true" />
          <span>Telegram</span>
        </a>
        <button type="button" class="nimiq-pay-advisory__continue" id="nimiq-pay-advisory-continue">
          Continue
        </button>
        <a
          class="nimiq-pay-advisory__social"
          href="${X_URL}"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img class="nimiq-pay-advisory__social-icon" src="${xIconUrl}" alt="" width="18" height="18" aria-hidden="true" />
          <span>X</span>
        </a>
      </div>
    </div>
  `;

  const backdrop = root.querySelector(".nimiq-pay-advisory__backdrop") as HTMLElement;
  const continueBtn = root.querySelector("#nimiq-pay-advisory-continue") as HTMLButtonElement;
  const siteLink = root.querySelector("#nimiq-pay-advisory-site-link") as HTMLAnchorElement | null;
  const copyTip = root.querySelector("#nimiq-pay-advisory-copy-tip") as HTMLElement | null;
  const bodyEl = root.querySelector("#nimiq-pay-advisory-body") as HTMLElement | null;
  const ac = new AbortController();
  const { signal } = ac;

  let hideTipTimer: ReturnType<typeof setTimeout> | null = null;

  function hideCopyTip(): void {
    if (hideTipTimer !== null) {
      clearTimeout(hideTipTimer);
      hideTipTimer = null;
    }
    bodyEl?.classList.remove("nimiq-pay-advisory__body--tip-visible");
    if (copyTip) {
      copyTip.hidden = true;
      copyTip.textContent = "";
    }
  }

  function showCopyTip(message: string): void {
    if (!copyTip) return;
    copyTip.textContent = message;
    copyTip.hidden = false;
    bodyEl?.classList.add("nimiq-pay-advisory__body--tip-visible");
    if (hideTipTimer !== null) clearTimeout(hideTipTimer);
    hideTipTimer = setTimeout(() => {
      hideTipTimer = null;
      copyTip.hidden = true;
      copyTip.textContent = "";
      bodyEl?.classList.remove("nimiq-pay-advisory__body--tip-visible");
    }, COPY_TIP_MS);
  }

  function dismiss(): void {
    hideCopyTip();
    ac.abort();
    root.remove();
  }

  continueBtn.addEventListener("click", () => dismiss(), { signal });
  backdrop.addEventListener("click", () => dismiss(), { signal });
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape") dismiss();
    },
    { signal }
  );

  if (siteLink) {
    siteLink.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        void (async () => {
          const ok = await copyTextToClipboard(NIMIQ_SPACE_URL.trim());
          showCopyTip(ok ? COPY_TIP_OK : COPY_TIP_FAIL);
        })();
      },
      { signal }
    );
  }

  host.appendChild(root);
  requestAnimationFrame(() => {
    if (root.isConnected) continueBtn.focus();
  });

  return () => dismiss();
}
