import { apiUrl } from "../net/apiBase.js";
import { dataUrlFromFaceToken } from "./faceToken.js";
import {
  AMBIENT_CAST_VISIBLE_CAP,
  selectSoftDensityTokens,
} from "./softDensity.js";

export const AMBIENT_CAST_REFRESH_MS = 5 * 60 * 1000;
export const AMBIENT_CAST_CYCLE_MS = 45_000;

type AmbientCastSnapshot = {
  day: string;
  refreshedAt: number;
  faces: { token: string }[];
};

type Floater = {
  token: string;
  img: HTMLImageElement | null;
  /** Top or bottom half of the play square (relative to the login card). */
  lane: "top" | "bottom";
  /** 0..1 across the play width. */
  t: number;
  /** 0..1 depth inside the lane (0 = nearer card, 1 = toward screen edge). */
  depth: number;
  drift: number;
  bobPhase: number;
  size: number;
  emoteUntil: number;
  emoteGlyph: string;
};

const EMOTE_GLYPHS = ["👋", "❤️", "✨", "😊"];

/** Extra px beyond the card on left/right (kept tight for mobile). */
export const AMBIENT_SIDE_PAD = 16;
/** Inset from the viewport top/bottom edges. */
export const AMBIENT_EDGE_INSET = 20;
/** Gap between the card and the start of each lane. */
export const AMBIENT_CARD_GAP = 12;

function ambientCastDebugEnabled(): boolean {
  if (typeof location === "undefined") return false;
  try {
    const q = new URLSearchParams(location.search);
    if (q.get("ambientCastDebug") === "1") return true;
    if (q.get("ambientCastDebug") === "0") return false;
    return localStorage.getItem("nspace_ambient_cast_debug") === "1";
  } catch {
    return false;
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export type MountAmbientCastOptions = {
  /** Full-viewport ambient host (pointer-events none). */
  host: HTMLElement;
  /** Login card to hover around (outside). */
  around: HTMLElement;
};

type PlayArea = {
  /** Card center in host coords. */
  cx: number;
  cy: number;
  cardLeft: number;
  cardTop: number;
  cardRight: number;
  cardBottom: number;
  /** Square-ish play box: tight to card sides, tall toward screen top/bottom. */
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/**
 * Decorative Ambient Cast: identicons fill the space above and below the login
 * card, staying tight on the left/right for mobile. Pointer-events none.
 */
export function mountAmbientCast(opts: MountAmbientCastOptions): () => void {
  const { host, around } = opts;
  const layer = document.createElement("div");
  layer.className = "main-menu__ambient-cast";
  layer.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  canvas.className = "main-menu__ambient-cast-canvas";
  layer.appendChild(canvas);
  host.insertBefore(layer, host.firstChild);

  const ctx = canvas.getContext("2d");
  let tokens: string[] = [];
  let floaters: Floater[] = [];
  let raf = 0;
  let disposed = false;
  let resizeObs: ResizeObserver | null = null;
  let refreshTimer: ReturnType<typeof setInterval> | null = null;
  let cycleTimer: ReturnType<typeof setInterval> | null = null;
  let cycleIndex = 0;
  const reduced = prefersReducedMotion();

  const syncSize = (): void => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const rebuildFloaters = (): void => {
    const staged = selectSoftDensityTokens(tokens, {
      visibleCap: AMBIENT_CAST_VISIBLE_CAP,
      cycleIndex,
    });
    const prev = new Map(floaters.map((f) => [f.token, f]));
    floaters = staged.map((token, i) => {
      const existing = prev.get(token);
      if (existing) return existing;
      const seed = hashSeed(token + String(i));
      const f: Floater = {
        token,
        img: null,
        lane: i % 2 === 0 ? "top" : "bottom",
        t: (seed % 1000) / 1000,
        depth: 0.15 + ((seed >> 10) % 850) / 1000,
        drift: (0.04 + ((seed >> 8) % 80) / 1000) * (seed & 1 ? 1 : -1),
        bobPhase: (seed % 628) / 100,
        size: 40 + (seed % 14),
        emoteUntil: 0,
        emoteGlyph: EMOTE_GLYPHS[seed % EMOTE_GLYPHS.length]!,
      };
      void dataUrlFromFaceToken(token).then((url) => {
        if (disposed || !url) return;
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        f.img = img;
      });
      return f;
    });
  };

  const fetchSnapshot = async (): Promise<void> => {
    try {
      const res = await fetch(apiUrl("/api/ambient-cast"), {
        credentials: "omit",
      });
      if (!res.ok) return;
      const data = (await res.json()) as AmbientCastSnapshot;
      const next = (data.faces ?? [])
        .map((f) => String(f?.token || "").trim())
        .filter(Boolean);
      tokens = next;
      rebuildFloaters();
    } catch {
      /* decorative — ignore */
    }
  };

  const playAreaInHost = (): PlayArea | null => {
    const hostRect = host.getBoundingClientRect();
    const cardRect = around.getBoundingClientRect();
    if (cardRect.width < 8 || cardRect.height < 8) return null;
    const w = host.clientWidth;
    const h = host.clientHeight;
    const cardLeft = cardRect.left - hostRect.left;
    const cardTop = cardRect.top - hostRect.top;
    const cardRight = cardLeft + cardRect.width;
    const cardBottom = cardTop + cardRect.height;
    const cx = cardLeft + cardRect.width / 2;
    const cy = cardTop + cardRect.height / 2;

    // Tight to the card horizontally; clamp to the viewport on narrow phones.
    let left = cardLeft - AMBIENT_SIDE_PAD;
    let right = cardRight + AMBIENT_SIDE_PAD;
    left = Math.max(AMBIENT_EDGE_INSET, left);
    right = Math.min(w - AMBIENT_EDGE_INSET, right);

    // Tall toward the top and bottom of the screen (upper + lower halves).
    const top = AMBIENT_EDGE_INSET;
    const bottom = h - AMBIENT_EDGE_INSET;

    // Prefer a square play box: expand height already spans the screen; if the
    // width is much narrower, keep width card-tight (mobile). If there is room
    // horizontally without leaving the viewport, grow toward square using the
    // shorter of (available height span, available width).
    const heightSpan = bottom - top;
    const widthSpan = right - left;
    if (widthSpan < heightSpan) {
      // Already taller than wide (typical phone) - keep sides tight.
    } else {
      // Desktop: pull sides in toward a square centered on the card.
      const side = heightSpan;
      const half = side / 2;
      left = Math.max(AMBIENT_EDGE_INSET, cx - half);
      right = Math.min(w - AMBIENT_EDGE_INSET, cx + half);
    }

    return {
      cx,
      cy,
      cardLeft,
      cardTop,
      cardRight,
      cardBottom,
      left,
      right,
      top,
      bottom,
    };
  };

  const placeFloater = (
    area: PlayArea,
    floater: Floater,
    now: number
  ): { x: number; y: number } => {
    const width = Math.max(1, area.right - area.left);
    const bob = reduced ? 0 : Math.sin(now / 240 + floater.bobPhase) * 5;
    const x = area.left + floater.t * width;
    if (floater.lane === "top") {
      const laneBottom = area.cardTop - AMBIENT_CARD_GAP;
      const laneTop = area.top;
      const span = Math.max(1, laneBottom - laneTop);
      // depth 0 near card, 1 toward screen top
      const y = laneBottom - floater.depth * span + bob;
      return { x, y };
    }
    const laneTop = area.cardBottom + AMBIENT_CARD_GAP;
    const laneBottom = area.bottom;
    const span = Math.max(1, laneBottom - laneTop);
    const y = laneTop + floater.depth * span + bob;
    return { x, y };
  };

  const draw = (now: number): void => {
    if (!ctx || disposed) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const area = playAreaInHost();
    if (!area) {
      raf = requestAnimationFrame(draw);
      return;
    }

    const dt = reduced ? 0 : 0.016;
    for (const floater of floaters) {
      if (!reduced) {
        floater.t += floater.drift * dt;
        if (floater.t > 1) {
          floater.t = 1;
          floater.drift = -Math.abs(floater.drift);
        } else if (floater.t < 0) {
          floater.t = 0;
          floater.drift = Math.abs(floater.drift);
        }
        if (now > floater.emoteUntil && Math.random() < 0.0012) {
          floater.emoteUntil = now + 1800;
          floater.emoteGlyph =
            EMOTE_GLYPHS[Math.floor(Math.random() * EMOTE_GLYPHS.length)]!;
        }
      }
    }

    const placed = floaters.map((floater) => {
      const p = placeFloater(area, floater, now);
      return { floater, x: p.x, y: p.y };
    });
    placed.sort((a, b) => a.y - b.y);

    if (ambientCastDebugEnabled()) {
      ctx.save();
      // Full play square
      ctx.fillStyle = "rgba(252, 135, 2, 0.08)";
      ctx.fillRect(
        area.left,
        area.top,
        area.right - area.left,
        area.bottom - area.top
      );
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(252, 135, 2, 0.9)";
      ctx.strokeRect(
        area.left,
        area.top,
        area.right - area.left,
        area.bottom - area.top
      );
      // Top / bottom lanes
      ctx.fillStyle = "rgba(121, 184, 255, 0.16)";
      ctx.fillRect(
        area.left,
        area.top,
        area.right - area.left,
        Math.max(0, area.cardTop - AMBIENT_CARD_GAP - area.top)
      );
      ctx.fillRect(
        area.left,
        area.cardBottom + AMBIENT_CARD_GAP,
        area.right - area.left,
        Math.max(0, area.bottom - (area.cardBottom + AMBIENT_CARD_GAP))
      );
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(230, 237, 243, 0.55)";
      ctx.strokeRect(
        area.cardLeft,
        area.cardTop,
        area.cardRight - area.cardLeft,
        area.cardBottom - area.cardTop
      );
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(230, 237, 243, 0.9)";
      ctx.font = "12px monospace";
      ctx.textAlign = "left";
      ctx.fillText(
        `play ${Math.round(area.right - area.left)}×${Math.round(area.bottom - area.top)}  sidePad ${AMBIENT_SIDE_PAD}`,
        12,
        20
      );
      ctx.fillText(
        "?ambientCastDebug=1  (orange=play blue=top/bottom lanes)",
        12,
        36
      );
      ctx.restore();
    }

    for (const { floater, x, y } of placed) {
      const size = floater.size;
      ctx.save();
      ctx.globalAlpha = 0.9;

      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.beginPath();
      ctx.ellipse(x, y + size * 0.42, size * 0.28, size * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();

      if (floater.img && floater.img.complete && floater.img.naturalWidth > 0) {
        ctx.drawImage(floater.img, x - size / 2, y - size / 2, size, size);
      } else {
        ctx.fillStyle = "rgba(121, 184, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      if (now < floater.emoteUntil) {
        ctx.globalAlpha = 0.95;
        ctx.font = `${Math.round(size * 0.42)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(floater.emoteGlyph, x, y - size * 0.62);
      }
      ctx.restore();
    }

    raf = requestAnimationFrame(draw);
  };

  syncSize();
  resizeObs = new ResizeObserver(() => syncSize());
  resizeObs.observe(host);
  resizeObs.observe(around);

  void fetchSnapshot();
  refreshTimer = setInterval(() => {
    void fetchSnapshot();
  }, AMBIENT_CAST_REFRESH_MS);

  cycleTimer = setInterval(() => {
    cycleIndex += 1;
    rebuildFloaters();
  }, AMBIENT_CAST_CYCLE_MS);

  raf = requestAnimationFrame(draw);

  return () => {
    disposed = true;
    cancelAnimationFrame(raf);
    if (refreshTimer) clearInterval(refreshTimer);
    if (cycleTimer) clearInterval(cycleTimer);
    resizeObs?.disconnect();
    layer.remove();
  };
}
