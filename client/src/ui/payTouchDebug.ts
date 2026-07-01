import { copyTextToClipboard } from "../util/copyText.js";

export type PayTouchGameSnapshot = {
  touchPointerCount: number;
  pendingWalk: boolean;
  pendingWalkPointerId: number | null;
  worldcupStick: boolean;
  canvasCapturePointerIds: number[];
};

export type PayTouchDebugSnapshot = {
  game: PayTouchGameSnapshot | null;
  actionWheelOpen: boolean | null;
  route: string;
  pseudoFs: boolean;
  payHost: boolean;
};

export type PayTouchDebugHooks = {
  getSnapshot: () => PayTouchDebugSnapshot;
  onForceUnfreeze: () => void;
};

const MAX_LOG = 14;

/** On-screen touch debugger for Nimiq Pay (no devtools). Opt-in only. */
export function isPayTouchDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (localStorage.getItem("nspace.payDebug") === "1") return true;
  } catch {
    /* ignore */
  }
  if (new URLSearchParams(location.search).get("payDebug") === "1") return true;
  return false;
}

function describeEl(el: Element | null): string {
  if (!el) return "(none)";
  if (el === document.documentElement) return "html";
  if (el === document.body) return "body";
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls =
    el instanceof HTMLElement && el.className
      ? `.${String(el.className).trim().split(/\s+/).slice(0, 2).join(".")}`
      : "";
  return `${tag}${id}${cls}`;
}

function scanFullscreenBlockers(): string[] {
  const out: string[] = [];
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const probes = [
    ["ctr", vw / 2, vh / 2],
    ["tl", 24, 24],
    ["br", vw - 24, vh - 24],
  ] as const;
  for (const [label, x, y] of probes) {
    const el = document.elementFromPoint(x, y);
    out.push(`${label}:${describeEl(el)}`);
  }

  for (const node of document.querySelectorAll("body *")) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.hidden) continue;
    const st = getComputedStyle(node);
    if (st.display === "none" || st.visibility === "hidden") continue;
    if (parseFloat(st.opacity) < 0.05) continue;
    if (st.pointerEvents === "none") continue;
    if (st.position !== "fixed" && st.position !== "absolute") continue;
    const r = node.getBoundingClientRect();
    if (r.width < vw * 0.85 || r.height < vh * 0.85) continue;
    if (node.classList.contains("pay-touch-debug")) continue;
    out.push(
      `layer z=${st.zIndex} ${describeEl(node)} ${Math.round(r.width)}×${Math.round(r.height)}`
    );
  }
  return out;
}

function formatSnapshotLine(snap: PayTouchDebugSnapshot): string {
  const g = snap.game;
  return `snap game touch=${g?.touchPointerCount ?? "?"} walk=${g?.pendingWalk ? g.pendingWalkPointerId : "no"} cap=[${g?.canvasCapturePointerIds.join(",") ?? ""}] stick=${g?.worldcupStick ? "Y" : "n"} wheel=${snap.actionWheelOpen ? "OPEN" : snap.actionWheelOpen === false ? "closed" : "?"} route=${snap.route} pay=${snap.payHost ? "Y" : "n"} pseudoFs=${snap.pseudoFs ? "Y" : "n"}`;
}

function buildCopyPayload(lines: string[], snap: PayTouchDebugSnapshot): string {
  const header = [
    "Nimiq Space - Pay touch debug",
    new Date().toISOString(),
    formatSnapshotLine(snap),
    "--- log ---",
  ];
  return [...header, ...lines].join("\n");
}

function releaseAllPointerCaptures(): number {
  let released = 0;
  for (const canvas of document.querySelectorAll("canvas")) {
    for (let id = 0; id < 32; id++) {
      try {
        if (canvas.hasPointerCapture?.(id)) {
          canvas.releasePointerCapture(id);
          released++;
        }
      } catch {
        /* ignore */
      }
    }
  }
  for (const btn of document.querySelectorAll("button")) {
    for (let id = 0; id < 32; id++) {
      try {
        if (btn.hasPointerCapture?.(id)) {
          btn.releasePointerCapture(id);
          released++;
        }
      } catch {
        /* ignore */
      }
    }
  }
  return released;
}

function removeKnownStuckOverlays(): string[] {
  const removed: string[] = [];
  const selectors = [
    ".external-visit-confirm",
    ".loading-overlay:not([hidden])",
  ];
  for (const sel of selectors) {
    for (const node of document.querySelectorAll(sel)) {
      if (!(node instanceof HTMLElement)) continue;
      removed.push(describeEl(node));
      node.remove();
    }
  }
  for (const node of document.querySelectorAll(".loading-overlay")) {
    if (!(node instanceof HTMLElement)) continue;
    if (node.hidden) continue;
    node.hidden = true;
    removed.push(`hidden ${describeEl(node)}`);
  }
  return removed;
}

export function installPayTouchDebug(hooks: PayTouchDebugHooks): () => void {
  const root = document.createElement("div");
  root.className = "pay-touch-debug";
  root.setAttribute("role", "status");
  root.innerHTML = `
    <div class="pay-touch-debug__head-row">
      <div class="pay-touch-debug__head">Pay touch debug - Copy or screenshot to share</div>
      <button type="button" class="pay-touch-debug__min" data-act="toggle-min" aria-label="Minimize debug panel">−</button>
    </div>
    <pre class="pay-touch-debug__log" aria-live="polite"></pre>
    <div class="pay-touch-debug__actions">
      <button type="button" class="pay-touch-debug__btn pay-touch-debug__btn--expanded-only" data-act="scan">Scan</button>
      <button type="button" class="pay-touch-debug__btn" data-act="copy">Copy</button>
      <button type="button" class="pay-touch-debug__btn pay-touch-debug__btn--warn" data-act="unfreeze">Unfreeze</button>
      <button type="button" class="pay-touch-debug__btn" data-act="clear">Clear</button>
    </div>
  `;
  document.body.appendChild(root);

  const logEl = root.querySelector(".pay-touch-debug__log") as HTMLPreElement;
  const minBtn = root.querySelector('[data-act="toggle-min"]') as HTMLButtonElement;
  const lines: string[] = [];
  let minimized = false;

  const readMinimizedPref = (): boolean => {
    try {
      return sessionStorage.getItem("nspace.payDebugMinimized") === "1";
    } catch {
      return false;
    }
  };

  const setMinimized = (next: boolean): void => {
    minimized = next;
    root.classList.toggle("pay-touch-debug--minimized", next);
    minBtn.textContent = next ? "+" : "−";
    minBtn.setAttribute(
      "aria-label",
      next ? "Expand debug panel" : "Minimize debug panel"
    );
    try {
      sessionStorage.setItem("nspace.payDebugMinimized", next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  setMinimized(readMinimizedPref());

  const push = (line: string): void => {
    const t = new Date();
    const ts = `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}:${String(t.getSeconds()).padStart(2, "0")}.${String(t.getMilliseconds()).padStart(3, "0")}`;
    lines.push(`${ts} ${line}`);
    while (lines.length > MAX_LOG) lines.shift();
    logEl.textContent = lines.join("\n");
  };

  const renderSnapshot = (): void => {
    push(formatSnapshotLine(hooks.getSnapshot()));
  };

  const runCopy = async (): Promise<void> => {
    const snap = hooks.getSnapshot();
    const payload = buildCopyPayload(lines, snap);
    const ok = await copyTextToClipboard(payload);
    push(ok ? "copy ok (paste anywhere)" : "copy failed");
  };

  const runScan = (): void => {
    for (const line of scanFullscreenBlockers()) push(`scan ${line}`);
    renderSnapshot();
  };

  const runUnfreeze = (): void => {
    push("unfreeze start");
    try {
      hooks.onForceUnfreeze();
    } catch (e) {
      push(`unfreeze hook err ${String(e)}`);
    }
    const removed = removeKnownStuckOverlays();
    for (const r of removed) push(`removed ${r}`);
    const rel = releaseAllPointerCaptures();
    push(`released ${rel} capture(s)`);
    runScan();
  };

  root.querySelector('[data-act="scan"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    runScan();
  });
  root.querySelector('[data-act="copy"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    void runCopy();
  });
  root.querySelector('[data-act="unfreeze"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    runUnfreeze();
  });
  root.querySelector('[data-act="clear"]')?.addEventListener("click", (e) => {
    e.stopPropagation();
    lines.length = 0;
    logEl.textContent = "";
  });
  minBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setMinimized(!minimized);
  });

  const onPtr = (e: PointerEvent): void => {
    if (minimized && root.contains(e.target as Node)) return;
    const tgt = e.target instanceof Node ? describeEl(e.target as Element) : "?";
    const pd = e.defaultPrevented ? " pd" : "";
    push(
      `${e.type} id=${e.pointerId} ${e.pointerType} btn=${e.button} ${tgt}${pd}`
    );
    if (e.type === "pointerdown") {
      const top = document.elementFromPoint(e.clientX, e.clientY);
      push(`  hit ${describeEl(top)}`);
    }
  };

  const opts: AddEventListenerOptions = { capture: true, passive: true };
  window.addEventListener("pointerdown", onPtr, opts);
  window.addEventListener("pointerup", onPtr, opts);
  window.addEventListener("pointercancel", onPtr, opts);

  const tick = (): void => {
    if (minimized) return;
    runScan();
  };
  const interval = window.setInterval(tick, 4000);

  push("debug on (?payDebug=1 or localStorage nspace.payDebug=1)");
  runScan();

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("pointerdown", onPtr, opts);
    window.removeEventListener("pointerup", onPtr, opts);
    window.removeEventListener("pointercancel", onPtr, opts);
    root.remove();
  };
}

export function defaultForceUnfreezeExtras(): { releasedCaptures: number; removed: string[] } {
  const removed = removeKnownStuckOverlays();
  const releasedCaptures = releaseAllPointerCaptures();
  return { releasedCaptures, removed };
}
