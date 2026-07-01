import { identiconDataUrl } from "../game/identiconTexture.js";
import { isValidUsernameCandidate, USERNAME_MAX_LEN } from "../auth/usernameConstants.js";
import { nimiqHexLoaderSvg } from "./nimiqHexLoader.js";

const USERNAME_PROMPT_LOAD_MS = 500;

export type UsernamePromptModalOptions = {
  /** Signed-in wallet - shows Nimiq identicon when set. */
  walletAddress?: string;
  deferralsRemaining: number;
  mustSetUsername: boolean;
  onSave: (username: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDefer?: () => Promise<{ ok: true } | { ok: false; error: string }>;
};

const ERROR_LABEL: Record<string, string> = {
  username_taken: "That username is already taken - try another.",
  invalid_username: "Use letters and numbers only (1–12 characters).",
  username_profanity: "That username is not allowed.",
  username_restricted: "That username is reserved.",
  username_set_banned: "You cannot set a username right now.",
  username_self_service_disabled: "Username changes are disabled.",
  username_cooldown: "Wait 24 hours before changing again.",
  username_prompt_required: "Choose a username to continue.",
  network: "Network error - try again.",
};

function errorLabel(code: string): string {
  return ERROR_LABEL[code] ?? "Could not save username.";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/** Shown when username prompt status cannot be loaded (cached re-entry must not skip the gate). */
export function showUsernamePromptStatusErrorModal(): Promise<"retry" | "cancel"> {
  return new Promise((resolve) => {
    const existing = document.getElementById("nspaceUsernamePromptStatusError");
    existing?.remove();

    const wrap = document.createElement("div");
    wrap.id = "nspaceUsernamePromptStatusError";
    wrap.setAttribute("role", "alertdialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;";

    const card = document.createElement("div");
    card.className = "username-prompt-overlay__card";

    const title = document.createElement("div");
    title.textContent = "Something went wrong";
    title.style.cssText = "font-weight:700;font-size:1rem;margin:0 0 0.5rem;";
    card.appendChild(title);

    const p = document.createElement("p");
    p.style.margin = "0 0 1rem";
    p.textContent = "We couldn't finish signing you in. Please try again in a moment.";
    card.appendChild(p);

    const btnRow = document.createElement("div");
    btnRow.className = "username-prompt__actions";

    const cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "username-prompt__btn username-prompt__btn--ghost";
    cancelBtn.addEventListener("click", () => {
      wrap.remove();
      resolve("cancel");
    });

    const retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.textContent = "Retry";
    retryBtn.className = "username-prompt__btn username-prompt__btn--primary";
    retryBtn.addEventListener("click", () => {
      wrap.remove();
      resolve("retry");
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(retryBtn);
    card.appendChild(btnRow);
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    retryBtn.focus();
  });
}

/** Blocking login prompt to pick a username; optional defer when allowed. */
export function showUsernamePromptModal(
  opts: UsernamePromptModalOptions
): Promise<"saved" | "deferred" | "cancelled"> {
  return new Promise((resolve) => {
    const existing = document.getElementById("nspaceUsernamePromptOverlay");
    existing?.remove();

    const wrap = document.createElement("div");
    wrap.id = "nspaceUsernamePromptOverlay";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-labelledby", "nspaceUsernamePromptTitle");
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483646;display:flex;align-items:center;justify-content:center;padding:1rem;box-sizing:border-box;";

    const card = document.createElement("div");
    card.className = "username-prompt-overlay__card";

    const loadingEl = document.createElement("div");
    loadingEl.className = "username-prompt__loading";
    loadingEl.setAttribute("role", "status");
    loadingEl.setAttribute("aria-live", "polite");
    loadingEl.setAttribute("aria-label", "Loading");
    loadingEl.innerHTML = nimiqHexLoaderSvg("username-prompt__spinner");
    card.appendChild(loadingEl);

    const contentEl = document.createElement("div");
    contentEl.className = "username-prompt__content";
    contentEl.hidden = true;

    const wallet = opts.walletAddress?.replace(/\s+/g, "").trim() ?? "";
    let ident: HTMLImageElement | null = null;
    if (wallet) {
      ident = document.createElement("img");
      ident.className = "username-prompt__ident";
      ident.alt = "";
      ident.width = 80;
      ident.height = 80;
      ident.decoding = "async";
      contentEl.appendChild(ident);
    }

    const title = document.createElement("h2");
    title.id = "nspaceUsernamePromptTitle";
    title.className = "username-prompt__title";
    title.textContent = "Pick a username";
    contentEl.appendChild(title);

    const input = document.createElement("input");
    input.type = "text";
    input.className = "username-prompt__input";
    input.maxLength = USERNAME_MAX_LEN;
    input.autocomplete = "username";
    input.spellcheck = false;
    input.setAttribute("aria-label", "Username");
    contentEl.appendChild(input);

    const showDefers =
      !opts.mustSetUsername && opts.onDefer !== undefined;
    const defersEl = document.createElement("p");
    defersEl.className = "username-prompt__defers";
    if (showDefers) {
      defersEl.textContent = `Defers Remaining: ${opts.deferralsRemaining}`;
    } else {
      defersEl.hidden = true;
    }
    contentEl.appendChild(defersEl);

    const errEl = document.createElement("p");
    errEl.className = "username-prompt__error";
    errEl.hidden = true;
    contentEl.appendChild(errEl);

    const btnRow = document.createElement("div");
    btnRow.className = "username-prompt__actions";

    let busy = false;
    let closed = false;

    const closeOverlay = (result: "saved" | "deferred" | "cancelled"): void => {
      if (closed) return;
      closed = true;
      wrap.remove();
      resolve(result);
    };

    let saveBtn: HTMLButtonElement;

    if (!opts.mustSetUsername && opts.onDefer) {
      const deferBtn = document.createElement("button");
      deferBtn.type = "button";
      deferBtn.textContent = "Not now";
      deferBtn.className = "username-prompt__btn username-prompt__btn--ghost";
      deferBtn.addEventListener("click", () => {
        if (busy) return;
        busy = true;
        deferBtn.disabled = true;
        saveBtn.disabled = true;
        void opts
          .onDefer!()
          .then((r) => {
            if (r.ok) closeOverlay("deferred");
            else {
              errEl.hidden = false;
              errEl.textContent = errorLabel(r.error);
              busy = false;
              deferBtn.disabled = false;
              saveBtn.disabled = false;
            }
          })
          .catch(() => {
            errEl.hidden = false;
            errEl.textContent = errorLabel("network");
            busy = false;
            deferBtn.disabled = false;
            saveBtn.disabled = false;
          });
      });
      btnRow.appendChild(deferBtn);
    }

    saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.textContent = "Save";
    saveBtn.className = "username-prompt__btn username-prompt__btn--primary";
    saveBtn.addEventListener("click", () => {
      if (busy) return;
      errEl.hidden = true;
      const raw = input.value.trim();
      if (!isValidUsernameCandidate(raw)) {
        errEl.hidden = false;
        errEl.textContent = errorLabel("invalid_username");
        return;
      }
      busy = true;
      saveBtn.disabled = true;
      void opts
        .onSave(raw)
        .then((r) => {
          if (r.ok) closeOverlay("saved");
          else {
            errEl.hidden = false;
            errEl.textContent = errorLabel(r.error);
            busy = false;
            saveBtn.disabled = false;
          }
        })
        .catch(() => {
          errEl.hidden = false;
          errEl.textContent = errorLabel("network");
          busy = false;
          saveBtn.disabled = false;
        });
    });
    btnRow.appendChild(saveBtn);

    input.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        saveBtn.click();
      }
    });

    contentEl.appendChild(btnRow);
    card.appendChild(contentEl);
    wrap.appendChild(card);

    if (!opts.mustSetUsername) {
      wrap.addEventListener("click", (ev) => {
        if (ev.target === wrap) closeOverlay("cancelled");
      });
    }

    document.body.appendChild(wrap);

    const identUrlPromise = wallet
      ? identiconDataUrl(wallet).catch(() => "")
      : Promise.resolve("");

    void Promise.all([delay(USERNAME_PROMPT_LOAD_MS), identUrlPromise]).then(
      ([, identUrl]) => {
        if (closed || !wrap.isConnected) return;
        if (ident && identUrl) {
          ident.src = identUrl;
        } else if (ident && !identUrl) {
          ident.remove();
        }
        loadingEl.hidden = true;
        contentEl.hidden = false;
        input.focus();
      }
    );
  });
}
