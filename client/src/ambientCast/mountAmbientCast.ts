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
  /** Radians around the login card. */
  angle: number;
  /** Extra px beyond the card ellipse. */
  orbitPad: number;
  spin: number;
  bobPhase: number;
  size: number;
  emoteUntil: number;
  emoteGlyph: string;
};

const EMOTE_GLYPHS = ["👋", "❤️", "✨", "😊"];

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

/**
 * Decorative Ambient Cast: identicons hover outside the Main Menu login card.
 * Pointer-events none. Returns a dispose function.
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
    const n = Math.max(1, staged.length);
    floaters = staged.map((token, i) => {
      const existing = prev.get(token);
      if (existing) return existing;
      const seed = hashSeed(token + String(i));
      const f: Floater = {
        token,
        img: null,
        angle: (i / n) * Math.PI * 2 + ((seed % 100) / 100) * 0.35,
        orbitPad: 28 + (seed % 40),
        spin: (0.08 + ((seed >> 8) % 100) / 800) * (seed & 1 ? 1 : -1),
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

  const cardFrameInHost = (): {
    cx: number;
    cy: number;
    rx: number;
    ry: number;
  } | null => {
    const hostRect = host.getBoundingClientRect();
    const cardRect = around.getBoundingClientRect();
    if (cardRect.width < 8 || cardRect.height < 8) return null;
    return {
      cx: cardRect.left - hostRect.left + cardRect.width / 2,
      cy: cardRect.top - hostRect.top + cardRect.height / 2,
      rx: cardRect.width / 2,
      ry: cardRect.height / 2,
    };
  };

  const draw = (now: number): void => {
    if (!ctx || disposed) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const frame = cardFrameInHost();
    if (!frame) {
      raf = requestAnimationFrame(draw);
      return;
    }

    const dt = reduced ? 0 : 0.016;
    for (const floater of floaters) {
      if (!reduced) {
        floater.angle += floater.spin * dt;
        if (now > floater.emoteUntil && Math.random() < 0.0012) {
          floater.emoteUntil = now + 1800;
          floater.emoteGlyph =
            EMOTE_GLYPHS[Math.floor(Math.random() * EMOTE_GLYPHS.length)]!;
        }
      }
    }

    // Draw back-to-front by vertical position so lower faces sit in front.
    const placed = floaters.map((floater) => {
      const pad = floater.orbitPad;
      const rx = frame.rx + pad;
      const ry = frame.ry + pad * 0.85;
      const bob = reduced
        ? 0
        : Math.sin(now / 240 + floater.bobPhase) * 5;
      const x = frame.cx + Math.cos(floater.angle) * rx;
      const y = frame.cy + Math.sin(floater.angle) * ry + bob;
      return { floater, x, y };
    });
    placed.sort((a, b) => a.y - b.y);

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
