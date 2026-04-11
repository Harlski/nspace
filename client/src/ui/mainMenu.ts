import { fetchNonce, signInWithWallet, verifyWithServer } from "../auth/nimiq.js";
import { identiconDataUrl } from "../game/identiconTexture.js";
import { apiUrl } from "../net/apiBase.js";

const TELEGRAM_URL = "https://t.me/nimiqspace";
const X_URL = "https://x.com/nimiqspace";

/** Public asset — Vite serves `client/public` at `/`. */
const NIM_LOGO_SRC = "/branding/nimiq-nim-logo.svg";

/** First 4 + last 4 characters (Nimiq-style short display). */
function formatWalletAddressShort(address: string): string {
  const t = address.trim();
  if (t.length <= 8) return t;
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

/** Session replay UI only on loopback — not on public deployments (e.g. Vercel). */
function isReplayMenuHost(): boolean {
  if (typeof location === "undefined") return false;
  const h = location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h === "[::1]" ||
    h === "::1"
  );
}

type ReplaySessionRow = {
  sessionId: string;
  address: string;
  roomId: string;
  startedAt: number;
  endedAt: number | null;
};

type ReplayEventRow = {
  ts: number;
  kind: string;
  sessionId: string;
  address: string;
  roomId: string;
  durationMs?: number;
  payload?: Record<string, unknown>;
};

const REPLAY_KIND_LABEL: Record<string, string> = {
  session_start: "Connected",
  session_end: "Disconnected",
  move_to: "Move",
  place_block: "Place block",
  set_obstacle_props: "Edit block",
  remove_obstacle: "Remove block",
  move_obstacle: "Reposition block",
  place_extra_floor: "Expand floor",
  remove_extra_floor: "Remove floor",
  chat: "Chat",
};

function formatReplayTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

function formatDuration(startedAt: number, endedAt: number | null): string {
  if (endedAt === null) return "in progress";
  const sec = Math.round((endedAt - startedAt) / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return `${m}m ${sec % 60}s`;
}

function summarizePayload(kind: string, p?: Record<string, unknown>): string {
  if (!p) return "—";
  switch (kind) {
    case "chat":
      return JSON.stringify(String(p.text ?? "")).slice(0, 80);
    case "move_to":
      return `→ (${p.toX},${p.toZ}) layer ${p.goalLayer ?? 0}`;
    case "place_block":
    case "remove_obstacle":
    case "set_obstacle_props":
      return `tile (${p.x},${p.z})`;
    case "move_obstacle":
      return `(${p.fromX},${p.fromZ}) → (${p.toX},${p.toZ})`;
    case "place_extra_floor":
    case "remove_extra_floor":
      return `tile (${p.x},${p.z})`;
    default:
      return JSON.stringify(p).slice(0, 96);
  }
}

async function replayFetchJson<T>(
  token: string,
  path: string
): Promise<T> {
  const r = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || r.statusText);
  }
  return r.json() as Promise<T>;
}

export type MainMenuOptions = {
  app: HTMLElement;
  hasValidSession: boolean;
  /** Saved wallet address (valid or expired session) for identicon + clear. */
  cachedAddress: string | null;
  /** JWT for `/api/replay/*` (session action log). */
  authToken: string | null;
  devBypass: boolean;
  onReconnect: () => void;
  onLoggedIn: (token: string, address: string) => void;
  onLogout: () => void;
};

/**
 * Full-screen lobby: title, floating hexes, identicon continue / Nimiq sign-in, social links.
 */
export function mountMainMenu(opts: MainMenuOptions): () => void {
  const {
    app,
    hasValidSession,
    cachedAddress,
    authToken,
    devBypass,
    onReconnect,
    onLoggedIn,
    onLogout,
  } = opts;
  app.innerHTML = "";

  const replayUiEnabled = isReplayMenuHost();

  const root = document.createElement("div");
  root.className = "main-menu";
  root.innerHTML = `
    <div class="main-menu__nim-layer" aria-hidden="true"></div>
    <div class="main-menu__content">
      <h1 class="main-menu__title">
        <span class="main-menu__title-nimiq">Nimiq</span>
        <span class="main-menu__title-space">Space</span>
      </h1>
      <div class="main-menu__user" id="main-menu-user" hidden>
        <div class="main-menu__identicon-wrap">
          <button type="button" class="main-menu__identicon-btn" id="btn-identicon-continue">
            <img class="main-menu__identicon" id="main-menu-identicon" width="56" height="56" alt="" />
          </button>
          <button type="button" class="main-menu__identicon-clear" id="btn-clear-cached-user" aria-label="Forget saved account">×</button>
        </div>
        <p class="main-menu__address" id="main-menu-address" hidden></p>
      </div>
      <div class="main-menu__err" id="main-menu-err" hidden></div>
      <div class="main-menu__actions">
        <button type="button" class="nq-button main-menu__nq-btn" id="btn-nimiq-account">
          Sign in with Nimiq
        </button>
        ${
          devBypass
            ? `<button type="button" class="nq-button light-blue main-menu__nq-btn" id="btn-dev-login">Dev login</button>`
            : ""
        }
      </div>
      ${
        replayUiEnabled
          ? `
      <div class="main-menu__replay">
        <button type="button" class="nq-button-s light-blue main-menu__nq-btn main-menu__replay-toggle" id="btn-replay-toggle" aria-expanded="false">
          Session replay
        </button>
        <div class="main-menu__replay-panel" id="replay-panel" hidden>
          <p class="main-menu__replay-hint" id="replay-hint"></p>
          <label class="main-menu__replay-field">
            <span>Player</span>
            <div class="main-menu__replay-row">
              <select class="main-menu__replay-select" id="replay-player-select" aria-label="Known players"></select>
              <input type="text" class="main-menu__replay-input" id="replay-address-input"
                placeholder="Or type address" spellcheck="false" autocomplete="off" />
            </div>
          </label>
          <div class="main-menu__replay-actions">
            <button type="button" class="nq-button-s light-blue main-menu__nq-btn" id="btn-replay-refresh-players">Refresh list</button>
            <button type="button" class="nq-button-s light-blue main-menu__nq-btn" id="btn-replay-load-sessions">Load sessions</button>
          </div>
          <div class="main-menu__replay-sessions" id="replay-sessions" role="list"></div>
          <div class="main-menu__replay-events-wrap" id="replay-events-wrap" hidden>
            <div class="main-menu__replay-events-title" id="replay-events-title">Actions</div>
            <pre class="main-menu__replay-events" id="replay-events"></pre>
          </div>
          <div class="main-menu__replay-err" id="replay-err" hidden></div>
        </div>
      </div>
      `
          : ""
      }
      <div class="main-menu__social">
        <a class="main-menu__social-link" href="${TELEGRAM_URL}" target="_blank" rel="noopener noreferrer">Telegram</a>
        <span class="main-menu__social-sep" aria-hidden="true">·</span>
        <a class="main-menu__social-link" href="${X_URL}" target="_blank" rel="noopener noreferrer">X (Twitter)</a>
      </div>
    </div>
  `;
  app.appendChild(root);

  const nimLayer = root.querySelector(".main-menu__nim-layer") as HTMLElement;
  const nNim = 16;
  for (let i = 0; i < nNim; i++) {
    const wrap = document.createElement("div");
    wrap.className = "main-menu__nim-wrap";
    wrap.style.left = `${8 + Math.random() * 84}%`;
    wrap.style.top = `${8 + Math.random() * 84}%`;
    wrap.style.setProperty("--rot", `${Math.random() * 360}deg`);
    const img = document.createElement("img");
    img.className = "main-menu__nim-logo";
    img.src = NIM_LOGO_SRC;
    img.alt = "";
    img.draggable = false;
    img.style.setProperty("--dur", `${18 + Math.random() * 22}s`);
    img.style.setProperty("--delay", `${-Math.random() * 25}s`);
    wrap.appendChild(img);
    nimLayer.appendChild(wrap);
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

  const userRow = root.querySelector("#main-menu-user") as HTMLElement;
  const identiconWrap = root.querySelector(
    ".main-menu__identicon-wrap"
  ) as HTMLElement;
  const addressEl = root.querySelector("#main-menu-address") as HTMLElement;
  const identiconImg = root.querySelector("#main-menu-identicon") as HTMLImageElement;
  const btnIdenticonContinue = root.querySelector(
    "#btn-identicon-continue"
  ) as HTMLButtonElement;
  const btnClearCached = root.querySelector(
    "#btn-clear-cached-user"
  ) as HTMLButtonElement;
  const btnNimiqAccount = root.querySelector(
    "#btn-nimiq-account"
  ) as HTMLButtonElement;

  if (cachedAddress) {
    userRow.hidden = false;
    addressEl.textContent = formatWalletAddressShort(cachedAddress);
    addressEl.hidden = false;
    if (hasValidSession) {
      identiconWrap.classList.add("main-menu__identicon-wrap--signed-in");
    }
    btnIdenticonContinue.setAttribute(
      "aria-label",
      hasValidSession ? "Continue with saved account" : "Sign in again with Nimiq"
    );
    btnNimiqAccount.textContent = "Login with Nimiq";
    void identiconDataUrl(cachedAddress)
      .then((url) => {
        identiconImg.src = url;
      })
      .catch(() => {
        userRow.hidden = true;
        addressEl.hidden = true;
      });
  } else {
    btnNimiqAccount.textContent = "Sign in with Nimiq";
    addressEl.textContent = "";
    addressEl.hidden = true;
  }

  const runNimiqWalletSignIn = async (): Promise<void> => {
    const { nonce } = await fetchNonce();
    const signed = await signInWithWallet(nonce);
    const { token, address } = await verifyWithServer(signed);
    onLoggedIn(token, address);
  };

  const setBusy = (busy: boolean): void => {
    btnIdenticonContinue.disabled = busy;
    btnNimiqAccount.disabled = busy;
    btnClearCached.disabled = busy;
    const devBtn = root.querySelector("#btn-dev-login") as
      | HTMLButtonElement
      | undefined;
    if (devBtn) devBtn.disabled = busy;
  };

  btnClearCached.addEventListener("click", (ev) => {
    ev.stopPropagation();
    showErr("");
    onLogout();
  });

  btnIdenticonContinue.addEventListener("click", async () => {
    if (!cachedAddress) return;
    showErr("");
    if (hasValidSession) {
      onReconnect();
      return;
    }
    setBusy(true);
    try {
      await runNimiqWalletSignIn();
    } catch (e) {
      showErr(e instanceof Error ? e.message : "login_failed");
      setBusy(false);
    }
  });

  btnNimiqAccount.addEventListener("click", async () => {
    showErr("");
    setBusy(true);
    try {
      await runNimiqWalletSignIn();
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

  if (!replayUiEnabled) {
    return () => {
      app.innerHTML = "";
    };
  }

  const replayToggle = root.querySelector("#btn-replay-toggle") as HTMLButtonElement;
  const replayPanel = root.querySelector("#replay-panel") as HTMLElement;
  const replayHint = root.querySelector("#replay-hint") as HTMLElement;
  const replayPlayerSelect = root.querySelector("#replay-player-select") as HTMLSelectElement;
  const replayAddressInput = root.querySelector("#replay-address-input") as HTMLInputElement;
  const replaySessionsEl = root.querySelector("#replay-sessions") as HTMLElement;
  const replayEventsWrap = root.querySelector("#replay-events-wrap") as HTMLElement;
  const replayEventsTitle = root.querySelector("#replay-events-title") as HTMLElement;
  const replayEventsPre = root.querySelector("#replay-events") as HTMLElement;
  const replayErr = root.querySelector("#replay-err") as HTMLElement;

  const showReplayErr = (s: string): void => {
    if (!s) {
      replayErr.hidden = true;
      replayErr.textContent = "";
      return;
    }
    replayErr.hidden = false;
    replayErr.textContent = s;
  };

  replayToggle.addEventListener("click", () => {
    const open = replayPanel.hidden;
    replayPanel.hidden = !open;
    replayToggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (open) {
      if (authToken) {
        replayHint.textContent =
          "Pick a player, load their sessions, then open one to see moves, builds, and chat from that visit.";
      } else {
        replayHint.textContent =
          "Sign in (wallet or dev) to load replay data from the server.";
      }
    }
  });

  const effectiveReplayToken = (): string | null => authToken;

  const setPlayersInSelect = (players: string[]): void => {
    replayPlayerSelect.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "— select —";
    replayPlayerSelect.appendChild(opt0);
    for (const p of players) {
      const o = document.createElement("option");
      o.value = p;
      o.textContent = p.length > 22 ? `${p.slice(0, 10)}…${p.slice(-8)}` : p;
      replayPlayerSelect.appendChild(o);
    }
  };

  root.querySelector("#btn-replay-refresh-players")?.addEventListener("click", async () => {
    showReplayErr("");
    const token = effectiveReplayToken();
    if (!token) {
      showReplayErr("Sign in first.");
      return;
    }
    try {
      const data = await replayFetchJson<{ players: string[] }>(
        token,
        "/api/replay/players?days=7&limit=200"
      );
      setPlayersInSelect(data.players ?? []);
    } catch (e) {
      showReplayErr(e instanceof Error ? e.message : "replay_failed");
    }
  });

  const selectedPlayerAddress = (): string => {
    const fromSelect = replayPlayerSelect.value.trim();
    const manual = replayAddressInput.value.trim();
    return manual || fromSelect;
  };

  root.querySelector("#btn-replay-load-sessions")?.addEventListener("click", async () => {
    showReplayErr("");
    replayEventsWrap.hidden = true;
    replaySessionsEl.innerHTML = "";
    const token = effectiveReplayToken();
    if (!token) {
      showReplayErr("Sign in first.");
      return;
    }
    const address = selectedPlayerAddress();
    if (!address) {
      showReplayErr("Choose or enter a player address.");
      return;
    }
    try {
      const data = await replayFetchJson<{ sessions: ReplaySessionRow[] }>(
        token,
        `/api/replay/sessions?address=${encodeURIComponent(address)}&days=14`
      );
      const sessions = data.sessions ?? [];
      if (sessions.length === 0) {
        replaySessionsEl.textContent = "No sessions found in the last 14 days.";
        return;
      }
      for (const s of sessions) {
        const row = document.createElement("button");
        row.type = "button";
        row.className = "main-menu__replay-session-btn";
        row.setAttribute("role", "listitem");
        const when = formatReplayTime(s.startedAt);
        const dur = formatDuration(s.startedAt, s.endedAt);
        row.textContent = `${when} · ${s.roomId} · ${dur}`;
        row.title = s.sessionId;
        row.addEventListener("click", async () => {
          showReplayErr("");
          try {
            const ev = await replayFetchJson<{ events: ReplayEventRow[] }>(
              token,
              `/api/replay/session/${encodeURIComponent(s.sessionId)}/events?days=14`
            );
            const events = ev.events ?? [];
            replayEventsTitle.textContent = `Actions (${events.length}) — ${s.sessionId.slice(0, 12)}…`;
            const lines: string[] = [];
            for (const e of events) {
              if (e.kind === "session_start" || e.kind === "session_end") {
                lines.push(
                  `[${formatReplayTime(e.ts)}] ${REPLAY_KIND_LABEL[e.kind] ?? e.kind}`
                );
                continue;
              }
              const label = REPLAY_KIND_LABEL[e.kind] ?? e.kind;
              const extra = summarizePayload(e.kind, e.payload);
              lines.push(`[${formatReplayTime(e.ts)}] ${label}: ${extra}`);
            }
            replayEventsPre.textContent = lines.join("\n");
            replayEventsWrap.hidden = false;
          } catch (err) {
            showReplayErr(err instanceof Error ? err.message : "events_failed");
          }
        });
        replaySessionsEl.appendChild(row);
      }
    } catch (e) {
      showReplayErr(e instanceof Error ? e.message : "sessions_failed");
    }
  });

  return () => {
    app.innerHTML = "";
  };
}
