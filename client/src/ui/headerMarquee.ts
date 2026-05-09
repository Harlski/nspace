import { apiUrl } from "../net/apiBase.js";

type LeaderboardRow = {
  walletId: string;
  displayLabel: string;
  streakDays: number;
  identicon: string;
};

type MarqueePayload = {
  visible: boolean;
  newsMessages: string[];
  marqueeStreakSeconds: number;
  marqueeMessageSeconds: number;
  leaderboard: LeaderboardRow[];
};

const POLL_MS = 90_000;

/** After the player has seen every announcement line once, hide the marquee for this long if lines unchanged. */
const NEWS_SUPPRESS_MS = 10 * 60 * 1000;

const LS_NEWS_SUPPRESS = "nspace.headerMarquee.newsSuppress";

function newsMessagesSig(messages: string[]): string {
  return messages.join("\x1e");
}

function readNewsSuppress(): { until: number; sig: string } | null {
  try {
    const raw = localStorage.getItem(LS_NEWS_SUPPRESS);
    if (!raw) return null;
    const j = JSON.parse(raw) as { until?: unknown; sig?: unknown };
    if (typeof j.until !== "number" || typeof j.sig !== "string") return null;
    if (Date.now() >= j.until) {
      localStorage.removeItem(LS_NEWS_SUPPRESS);
      return null;
    }
    return { until: j.until, sig: j.sig };
  } catch {
    return null;
  }
}

function shouldSuppressNewsForSig(sig: string): boolean {
  const s = readNewsSuppress();
  return Boolean(s && s.sig === sig);
}

function writeNewsSuppress(sig: string): void {
  try {
    localStorage.setItem(
      LS_NEWS_SUPPRESS,
      JSON.stringify({ until: Date.now() + NEWS_SUPPRESS_MS, sig })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function h(tag: string, className?: string): HTMLElement {
  const n = document.createElement(tag);
  if (className) n.className = className;
  return n;
}

function dedupeLeaderboardRows(rows: LeaderboardRow[]): LeaderboardRow[] {
  const seen = new Set<string>();
  const out: LeaderboardRow[] = [];
  for (const r of rows) {
    const k = String(r.walletId || "")
      .replace(/\s+/g, "")
      .trim()
      .toUpperCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

function disambiguateDisplayLabels(rows: LeaderboardRow[]): LeaderboardRow[] {
  const labels = rows.map((r) => r.displayLabel);
  const countBy = new Map<string, number>();
  for (const l of labels) countBy.set(l, (countBy.get(l) ?? 0) + 1);
  return rows.map((r, i) => {
    const label = labels[i]!;
    if ((countBy.get(label) ?? 0) <= 1) return r;
    const compact = String(r.walletId || "").replace(/\s+/g, "").toUpperCase();
    const short =
      compact.length <= 8
        ? compact
        : `${compact.slice(0, 4)}${compact.slice(-4)}`;
    return { ...r, displayLabel: `${label} (${short})` };
  });
}

function buildStreakTicker(rows: LeaderboardRow[]): HTMLElement {
  const wrap = h("div", "hud-header-marquee__ticker");
  const inner = h("div", "hud-header-marquee__ticker-track");
  const chunk = h("div", "hud-header-marquee__ticker-chunk");
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const slot = h("span", "hud-header-marquee__entry");
    const fire = document.createElement("span");
    fire.className = "hud-header-marquee__fire";
    fire.textContent = "\u{1F525}";
    fire.setAttribute("aria-hidden", "true");
    const img = document.createElement("img");
    img.className = "hud-header-marquee__ident";
    img.alt = "";
    img.width = 18;
    img.height = 18;
    img.decoding = "sync";
    if (row.identicon) img.src = row.identicon;
    const name = h("span", "hud-header-marquee__name");
    name.textContent = row.displayLabel;
    const days = h("span", "hud-header-marquee__days");
    const d = row.streakDays;
    days.textContent = d === 1 ? " (1 day)" : ` (${d} days!)`;
    slot.appendChild(fire);
    slot.appendChild(img);
    slot.appendChild(name);
    slot.appendChild(days);
    chunk.appendChild(slot);
    if (i < rows.length - 1) {
      const sep = h("span", "hud-header-marquee__sep");
      sep.textContent = " \u00b7 ";
      chunk.appendChild(sep);
    }
  }
  const fill = h("span", "hud-header-marquee__ticker-chunk-fill");
  fill.setAttribute("aria-hidden", "true");
  chunk.appendChild(fill);
  inner.appendChild(chunk);
  inner.appendChild(chunk.cloneNode(true) as HTMLElement);
  wrap.appendChild(inner);
  return wrap;
}

type TickerScrollOpts = {
  /** Fires after each horizontal loop (one full pass of duplicated streak content). */
  onScrollLoop?: () => void;
  /** If set, also arm a one-shot timer so we still advance if `animationiteration` never fires. */
  fallbackLoopMs?: number;
};

function attachStreakTickerScroll(
  wrap: HTMLElement,
  opts?: TickerScrollOpts
): () => void {
  const track = wrap.querySelector(
    ".hud-header-marquee__ticker-track"
  ) as HTMLElement | null;
  if (!track) return () => {};

  let fired = false;
  let fbTimer: ReturnType<typeof setTimeout> | null = null;

  function onAnimIter(): void {
    fireLoop();
  }

  function fireLoop(): void {
    if (fired) return;
    fired = true;
    if (fbTimer !== null) {
      clearTimeout(fbTimer);
      fbTimer = null;
    }
    track.removeEventListener("animationiteration", onAnimIter);
    opts?.onScrollLoop?.();
  }

  const sync = (): void => {
    track.removeEventListener("animationiteration", onAnimIter);
    if (fbTimer !== null) {
      clearTimeout(fbTimer);
      fbTimer = null;
    }

    const fills = track.querySelectorAll(".hud-header-marquee__ticker-chunk-fill");
    for (const el of fills) {
      (el as HTMLElement).style.removeProperty("flex");
    }
    void track.offsetWidth;

    /** `scrollWidth` grows when identicons decode — must not measure only before images load. */
    const naturalHalf = track.scrollWidth / 2;
    const viewW = wrap.clientWidth;
    const pad = Math.max(0, Math.ceil(viewW - naturalHalf));
    for (const el of fills) {
      if (pad > 0) (el as HTMLElement).style.flex = `0 0 ${pad}px`;
    }
    void track.offsetWidth;

    const total = track.scrollWidth;
    const loop = total / 2;
    if (!Number.isFinite(loop) || loop <= 2 || viewW < 8) {
      for (const el of fills) {
        (el as HTMLElement).style.removeProperty("flex");
      }
      track.style.removeProperty("animation-duration");
      if (opts?.onScrollLoop && opts.fallbackLoopMs && opts.fallbackLoopMs > 0) {
        fbTimer = setTimeout(fireLoop, opts.fallbackLoopMs);
      }
      return;
    }
    /** Horizontal crawl speed (one CSS loop = −50% = one duplicated chunk). */
    const dur = Math.max(7, Math.min(36, loop / 42));
    track.style.animationDuration = `${dur}s`;

    if (opts?.onScrollLoop) {
      track.addEventListener("animationiteration", onAnimIter);
      if (opts.fallbackLoopMs && opts.fallbackLoopMs > 0) {
        fbTimer = setTimeout(fireLoop, opts.fallbackLoopMs);
      }
    }
  };

  let debounceRaf: number | null = null;
  const scheduleSync = (): void => {
    if (debounceRaf != null) cancelAnimationFrame(debounceRaf);
    debounceRaf = requestAnimationFrame(() => {
      debounceRaf = null;
      sync();
    });
  };

  sync();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      sync();
    });
  });

  const ro = new ResizeObserver(() => scheduleSync());
  ro.observe(wrap);
  ro.observe(track);

  const imgs = wrap.querySelectorAll("img");
  for (const img of imgs) {
    img.addEventListener("load", scheduleSync, { passive: true });
    img.addEventListener("error", scheduleSync, { passive: true });
    if (img.complete) scheduleSync();
  }

  return () => {
    if (debounceRaf != null) cancelAnimationFrame(debounceRaf);
    ro.disconnect();
    for (const img of imgs) {
      img.removeEventListener("load", scheduleSync);
      img.removeEventListener("error", scheduleSync);
    }
    track.removeEventListener("animationiteration", onAnimIter);
    if (fbTimer !== null) {
      clearTimeout(fbTimer);
      fbTimer = null;
    }
    track.style.animationDuration = "";
  };
}

function renderStreak(
  target: HTMLElement,
  rows: LeaderboardRow[],
  onTickerMount: ((wrap: HTMLElement) => () => void) | null
): void {
  target.replaceChildren();
  if (rows.length === 0) return;
  const wrap = buildStreakTicker(rows);
  target.appendChild(wrap);
  if (onTickerMount) {
    queueMicrotask(() => {
      const dispose = onTickerMount(wrap);
      (wrap as HTMLElement & { __mqDispose?: () => void }).__mqDispose =
        dispose;
    });
  }
}

function disposeStreakTickerIn(el: HTMLElement): void {
  const wrap = el.querySelector(".hud-header-marquee__ticker") as
    | (HTMLElement & { __mqDispose?: () => void })
    | null;
  wrap?.__mqDispose?.();
  if (wrap) delete wrap.__mqDispose;
}

function renderNews(target: HTMLElement, text: string): void {
  target.replaceChildren();
  const p = h("p", "hud-header-marquee__news");
  p.textContent = text;
  target.appendChild(p);
}

/**
 * In-game header marquee: login-streak ticker and/or rotating announcements (`/admin/header`).
 */
export function mountHeaderMarquee(host: HTMLElement): () => void {
  host.classList.add("hud-header-marquee-root");
  host.setAttribute("aria-hidden", "true");
  host.hidden = true;

  const bar = h("div", "hud-header-marquee");
  const viewport = h("div", "hud-header-marquee__viewport");
  const panelA = h("div", "hud-header-marquee__panel");
  const panelB = h("div", "hud-header-marquee__panel");
  viewport.appendChild(panelA);
  viewport.appendChild(panelB);
  bar.appendChild(viewport);
  host.appendChild(bar);

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let rotateTimer: ReturnType<typeof setTimeout> | null = null;
  let cancelled = false;
  /** Bumps on each `applyFromPayload` so stale timers / transitionend ignore superseded runs. */
  let marqueeApplyId = 0;

  let aIsFront = true;

  function beginNewsSuppressFade(applyId: number, sig: string): void {
    if (cancelled || applyId !== marqueeApplyId) return;
    clearRotate();
    clearPanels();
    host.hidden = false;
    host.classList.remove("hud-header-marquee-root--fading");
    void host.offsetWidth;
    host.classList.add("hud-header-marquee-root--fading");

    let finished = false;
    const settle = (): void => {
      if (cancelled) return;
      if (applyId !== marqueeApplyId) {
        host.classList.remove("hud-header-marquee-root--fading");
        return;
      }
      if (finished) return;
      finished = true;
      host.removeEventListener("transitionend", onEnd);
      host.classList.remove("hud-header-marquee-root--fading");
      host.hidden = true;
      writeNewsSuppress(sig);
    };

    const onEnd = (ev: TransitionEvent): void => {
      if (ev.target !== host || ev.propertyName !== "opacity") return;
      settle();
    };
    host.addEventListener("transitionend", onEnd);

    window.setTimeout(() => {
      settle();
    }, 700);
  }

  function clearRotate(): void {
    if (rotateTimer !== null) {
      clearTimeout(rotateTimer);
      rotateTimer = null;
    }
  }

  function clearPanels(): void {
    disposeStreakTickerIn(panelA);
    disposeStreakTickerIn(panelB);
    panelA.replaceChildren();
    panelB.replaceChildren();
    panelA.classList.remove("hud-header-marquee__panel--front");
    panelB.classList.remove("hud-header-marquee__panel--front");
  }

  function applyFront(): void {
    if (aIsFront) {
      panelA.classList.add("hud-header-marquee__panel--front");
      panelB.classList.remove("hud-header-marquee__panel--front");
    } else {
      panelB.classList.add("hud-header-marquee__panel--front");
      panelA.classList.remove("hud-header-marquee__panel--front");
    }
  }

  function scheduleStreakAndMessages(
    rows: LeaderboardRow[],
    messages: string[],
    streakFallbackMs: number,
    msgMs: number,
    applyId: number,
    msgSig: string
  ): void {
    clearRotate();
    aIsFront = true;
    let showingStreak = true;
    let msgIdx = 0;

    const mountStreakTicker = (wrap: HTMLElement): (() => void) =>
      attachStreakTickerScroll(wrap, {
        onScrollLoop: () => {
          if (cancelled || !showingStreak) return;
          afterStreakScrollLoop();
        },
        fallbackLoopMs: streakFallbackMs,
      });

    function afterStreakScrollLoop(): void {
      if (cancelled || !showingStreak || applyId !== marqueeApplyId) return;
      const back = aIsFront ? panelB : panelA;
      disposeStreakTickerIn(back);
      renderNews(back, messages[msgIdx] ?? "");
      void back.offsetHeight;
      aIsFront = !aIsFront;
      showingStreak = false;
      applyFront();
      rotateTimer = setTimeout(afterMessageSlice, msgMs);
    }

    function afterMessageSlice(): void {
      if (cancelled || applyId !== marqueeApplyId) return;
      const n = Math.max(1, messages.length);
      if (msgIdx === n - 1) {
        beginNewsSuppressFade(applyId, msgSig);
        return;
      }
      const back = aIsFront ? panelB : panelA;
      disposeStreakTickerIn(back);
      renderStreak(back, rows, mountStreakTicker);
      void back.offsetHeight;
      aIsFront = !aIsFront;
      showingStreak = true;
      msgIdx = (msgIdx + 1) % n;
      applyFront();
    }

    renderStreak(panelA, rows, mountStreakTicker);
    panelB.replaceChildren();
    applyFront();
  }

  function scheduleMessagesOnly(
    messages: string[],
    msgMs: number,
    applyId: number,
    msgSig: string
  ): void {
    clearRotate();
    if (messages.length === 0) return;
    aIsFront = true;
    let idx = 0;
    renderNews(panelA, messages[0]!);
    panelB.replaceChildren();
    panelA.classList.add("hud-header-marquee__panel--front");
    panelB.classList.remove("hud-header-marquee__panel--front");
    if (messages.length === 1) {
      rotateTimer = setTimeout(() => {
        if (cancelled || applyId !== marqueeApplyId) return;
        beginNewsSuppressFade(applyId, msgSig);
      }, msgMs);
      return;
    }

    const tick = (): void => {
      if (cancelled || applyId !== marqueeApplyId) return;
      const prev = idx;
      if (prev === messages.length - 1) {
        beginNewsSuppressFade(applyId, msgSig);
        return;
      }
      idx = (idx + 1) % messages.length;
      const back = aIsFront ? panelB : panelA;
      renderNews(back, messages[idx]!);
      void back.offsetHeight;
      aIsFront = !aIsFront;
      applyFront();
      rotateTimer = setTimeout(tick, msgMs);
    };
    rotateTimer = setTimeout(tick, msgMs);
  }

  function applyFromPayload(j: MarqueePayload): void {
    marqueeApplyId++;
    const applyId = marqueeApplyId;
    clearRotate();
    clearPanels();

    /**
     * Safety timeout if `animationiteration` never fires (must exceed longest ticker ~36s).
     * Server value is clamped so it cannot preempt a normal scroll loop.
     */
    const streakFallbackMs = Math.min(
      180_000,
      Math.max(55_000, Math.floor(Number(j.marqueeStreakSeconds) || 60) * 1000)
    );
    const msgMs = Math.min(
      120_000,
      Math.max(1000, Math.floor(Number(j.marqueeMessageSeconds) || 10) * 1000)
    );

    const rawRows = Array.isArray(j.leaderboard) ? j.leaderboard : [];
    const rows = disambiguateDisplayLabels(dedupeLeaderboardRows(rawRows));
    const messages = Array.isArray(j.newsMessages)
      ? j.newsMessages.map((x) => String(x || "").trim()).filter(Boolean)
      : [];

    const streakOn = rows.length > 0;
    const newsOn = messages.length > 0;
    const msgSig = newsMessagesSig(messages);

    if (!j.visible || (!streakOn && !newsOn)) {
      host.hidden = true;
      host.classList.remove("hud-header-marquee-root--fading");
      return;
    }

    if (newsOn && shouldSuppressNewsForSig(msgSig)) {
      host.hidden = true;
      host.classList.remove("hud-header-marquee-root--fading");
      return;
    }

    host.hidden = false;
    host.classList.remove("hud-header-marquee-root--fading");

    if (streakOn && !newsOn) {
      renderStreak(panelA, rows, attachStreakTickerScroll);
      panelA.classList.add("hud-header-marquee__panel--front");
      return;
    }
    if (!streakOn && newsOn) {
      scheduleMessagesOnly(messages, msgMs, applyId, msgSig);
      return;
    }

    scheduleStreakAndMessages(rows, messages, streakFallbackMs, msgMs, applyId, msgSig);
  }

  async function pull(): Promise<void> {
    if (cancelled) return;
    try {
      const r = await fetch(apiUrl("/api/header-marquee"), { cache: "no-store" });
      if (!r.ok) return;
      const j = (await r.json()) as MarqueePayload & { newsMessage?: string };
      if (!Array.isArray(j.newsMessages)) {
        j.newsMessages = j.newsMessage ? [String(j.newsMessage)] : [];
      }
      applyFromPayload(j);
    } catch {
      /* ignore */
    }
  }

  void pull();
  pollTimer = setInterval(() => void pull(), POLL_MS);

  return () => {
    cancelled = true;
    clearRotate();
    clearPanels();
    if (pollTimer !== null) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
    host.classList.remove("hud-header-marquee-root--fading");
    host.replaceChildren();
    host.hidden = true;
  };
}
