import { fetchNonce, signInWithWallet, verifyWithServer } from "../auth/nimiq.js";

const TELEGRAM_URL = "https://t.me/nimiqspace";
const X_URL = "https://x.com/nimiqspace";

export type MainMenuOptions = {
  app: HTMLElement;
  hasValidSession: boolean;
  devBypass: boolean;
  onReconnect: () => void;
  onLoggedIn: (token: string, address: string) => void;
  onLogout: () => void;
};

/**
 * Full-screen lobby: title, floating hexes, connect / reconnect / logout, social links.
 */
export function mountMainMenu(opts: MainMenuOptions): () => void {
  const { app, hasValidSession, devBypass, onReconnect, onLoggedIn, onLogout } =
    opts;
  app.innerHTML = "";

  const root = document.createElement("div");
  root.className = "main-menu";
  root.innerHTML = `
    <div class="main-menu__hex-layer" aria-hidden="true"></div>
    <div class="main-menu__content">
      <h1 class="main-menu__title">Nimiq Space</h1>
      <p class="main-menu__subtitle">Walk the floor, build, chat — connect your wallet to enter.</p>
      <div class="main-menu__err" id="main-menu-err" hidden></div>
      <div class="main-menu__actions">
        <button type="button" class="btn btn-primary main-menu__btn-reconnect" id="btn-reconnect">
          Reconnect
        </button>
        <button type="button" class="btn btn-primary" id="btn-connect-wallet">
          Connect wallet
        </button>
        ${
          devBypass
            ? `<button type="button" class="btn btn-secondary" id="btn-dev-login">Dev login</button>`
            : ""
        }
        <button type="button" class="btn btn-ghost" id="btn-logout">Log out</button>
      </div>
      <div class="main-menu__social">
        <a class="main-menu__social-link" href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer">Telegram</a>
        <span class="main-menu__social-sep" aria-hidden="true">·</span>
        <a class="main-menu__social-link" href="${X_URL}" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
      </div>
    </div>
  `;
  app.appendChild(root);

  const hexLayer = root.querySelector(".main-menu__hex-layer") as HTMLElement;
  const nHex = 16;
  for (let i = 0; i < nHex; i++) {
    const wrap = document.createElement("div");
    wrap.className = "main-menu__hex-wrap";
    wrap.style.left = `${8 + Math.random() * 84}%`;
    wrap.style.top = `${8 + Math.random() * 84}%`;
    wrap.style.setProperty("--rot", `${Math.random() * 360}deg`);
    const inner = document.createElement("div");
    inner.className = "main-menu__hex";
    inner.style.setProperty("--dur", `${18 + Math.random() * 22}s`);
    inner.style.setProperty("--delay", `${-Math.random() * 25}s`);
    wrap.appendChild(inner);
    hexLayer.appendChild(wrap);
  }

  const errEl = root.querySelector("#main-menu-err") as HTMLElement;
  const showErr = (s: string): void => {
    if (!s) {
      errEl.hidden = true;
      errEl.textContent = "";
      return;
    }
    errEl.hidden = false;
    errEl.textContent = s;
  };

  const btnReconnect = root.querySelector("#btn-reconnect") as HTMLButtonElement;
  btnReconnect.hidden = !hasValidSession;

  const setBusy = (busy: boolean): void => {
    btnReconnect.disabled = busy;
    (root.querySelector("#btn-connect-wallet") as HTMLButtonElement).disabled =
      busy;
    const devBtn = root.querySelector("#btn-dev-login") as
      | HTMLButtonElement
      | undefined;
    if (devBtn) devBtn.disabled = busy;
  };

  btnReconnect.addEventListener("click", () => {
    showErr("");
    onReconnect();
  });

  root.querySelector("#btn-connect-wallet")?.addEventListener("click", async () => {
    showErr("");
    setBusy(true);
    try {
      const { nonce } = await fetchNonce();
      const signed = await signInWithWallet(nonce);
      const { token, address } = await verifyWithServer(signed);
      onLoggedIn(token, address);
    } catch (e) {
      showErr(e instanceof Error ? e.message : "login_failed");
      setBusy(false);
    }
  });

  root.querySelector("#btn-dev-login")?.addEventListener("click", async () => {
    showErr("");
    setBusy(true);
    try {
      const { nonce } = await fetchNonce();
      const message = `Login:v1:${nonce}`;
      const z32 = new Uint8Array(32);
      const z64 = new Uint8Array(64);
      const b64 = (u: Uint8Array): string => {
        let s = "";
        for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]!);
        return btoa(s);
      };
      const { token, address } = await verifyWithServer({
        nonce,
        message,
        signer: "NQ07 DEV0000000000000000000000000000000000",
        signerPublicKey: b64(z32),
        signature: b64(z64),
      });
      onLoggedIn(token, address);
    } catch (e) {
      showErr(e instanceof Error ? e.message : "dev_login_failed");
      setBusy(false);
    }
  });

  root.querySelector("#btn-logout")?.addEventListener("click", () => {
    onLogout();
  });

  return () => {
    app.innerHTML = "";
  };
}
