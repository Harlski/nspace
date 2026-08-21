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

type Walker = {
  token: string;
  img: HTMLImageElement | null;
  /** Isometric plane coords (u along NE, v along NW). */
  u: number;
  v: number;
  speed: number;
  bobPhase: number;
  emoteUntil: number;
  emoteGlyph: string;
  facing: 1 | -1;
};

const EMOTE_GLYPHS = ["👋", "❤️", "✨", "😊"];

function prefersReducedMotion(): boolean {
  return (
    typeof matchMedia === "function" &&
    matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function isoProject(u: number, v: number): { x: number; y: number } {
  return {
    x: (u - v) * 0.86,
    y: (u + v) * 0.42,
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Decorative Ambient Cast behind Main Menu chrome. Pointer-events none.
 * Returns a dispose function.
 */
export function mountAmbientCast(host: HTMLElement): () => void {
  const layer = document.createElement("div");
  layer.className = "main-menu__ambient-cast";
  layer.setAttribute("aria-hidden", "true");

  const canvas = document.createElement("canvas");
  canvas.className = "main-menu__ambient-cast-canvas";
  layer.appendChild(canvas);
  host.insertBefore(layer, host.firstChild);

  const ctx = canvas.getContext("2d");
  let tokens: string[] = [];
  let walkers: Walker[] = [];
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

  const rebuildWalkers = (): void => {
    const staged = selectSoftDensityTokens(tokens, {
      visibleCap: AMBIENT_CAST_VISIBLE_CAP,
      cycleIndex,
    });
    const prev = new Map(walkers.map((w) => [w.token, w]));
    walkers = staged.map((token, i) => {
      const existing = prev.get(token);
      if (existing) return existing;
      const seed = hashSeed(token + String(i));
      const w: Walker = {
        token,
        img: null,
        u: ((seed % 1000) / 1000) * 14 - 2,
        v: (((seed >> 10) % 1000) / 1000) * 10 - 1,
        speed: 0.35 + ((seed >> 20) % 100) / 200,
        bobPhase: (seed % 628) / 100,
        emoteUntil: 0,
        emoteGlyph: EMOTE_GLYPHS[seed % EMOTE_GLYPHS.length]!,
        facing: seed & 1 ? 1 : -1,
      };
      void dataUrlFromFaceToken(token).then((url) => {
        if (disposed || !url) return;
        const img = new Image();
        img.decoding = "async";
        img.src = url;
        w.img = img;
      });
      return w;
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
      rebuildWalkers();
    } catch {
      /* decorative — ignore */
    }
  };

  const draw = (now: number): void => {
    if (!ctx || disposed) return;
    const w = host.clientWidth;
    const h = host.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const originX = w * 0.5;
    const originY = h * 0.62;
    const scale = Math.min(w, h) * 0.055;

    // Soft isometric ground wash
    ctx.save();
    ctx.translate(originX, originY);
    ctx.fillStyle = "rgba(43, 94, 167, 0.07)";
    ctx.beginPath();
    const g0 = isoProject(-1, -1);
    const g1 = isoProject(16, -1);
    const g2 = isoProject(16, 12);
    const g3 = isoProject(-1, 12);
    ctx.moveTo(g0.x * scale, g0.y * scale);
    ctx.lineTo(g1.x * scale, g1.y * scale);
    ctx.lineTo(g2.x * scale, g2.y * scale);
    ctx.lineTo(g3.x * scale, g3.y * scale);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    const dt = reduced ? 0 : 0.016;
    for (const walker of walkers) {
      if (!reduced) {
        walker.u += walker.speed * walker.facing * dt;
        if (walker.u > 15) {
          walker.u = 15;
          walker.facing = -1;
        } else if (walker.u < -1) {
          walker.u = -1;
          walker.facing = 1;
        }
        if (now > walker.emoteUntil && Math.random() < 0.0015) {
          walker.emoteUntil = now + 1800;
          walker.emoteGlyph =
            EMOTE_GLYPHS[Math.floor(Math.random() * EMOTE_GLYPHS.length)]!;
        }
      }
    }

    const sorted = [...walkers].sort((a, b) => a.u + a.v - (b.u + b.v));
    for (const walker of sorted) {
      const p = isoProject(walker.u, walker.v);
      const bob = reduced
        ? 0
        : Math.sin(now / 220 + walker.bobPhase) * 3;
      const size = 36 + (walker.v % 3) * 2;
      const x = originX + p.x * scale;
      const y = originY + p.y * scale - size * 0.55 + bob;

      ctx.save();
      ctx.globalAlpha = 0.88;
      // Soft shadow on the plane
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.beginPath();
      ctx.ellipse(x, originY + p.y * scale + 4, size * 0.28, size * 0.1, 0, 0, Math.PI * 2);
      ctx.fill();

      if (walker.img && walker.img.complete && walker.img.naturalWidth > 0) {
        ctx.drawImage(walker.img, x - size / 2, y - size / 2, size, size);
      } else {
        ctx.fillStyle = "rgba(121, 184, 255, 0.35)";
        ctx.beginPath();
        ctx.arc(x, y, size * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }

      if (now < walker.emoteUntil) {
        ctx.globalAlpha = 0.95;
        ctx.font = `${Math.round(size * 0.45)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText(walker.emoteGlyph, x, y - size * 0.65);
      }
      ctx.restore();
    }

    raf = requestAnimationFrame(draw);
  };

  syncSize();
  resizeObs = new ResizeObserver(() => syncSize());
  resizeObs.observe(host);

  void fetchSnapshot();
  refreshTimer = setInterval(() => {
    void fetchSnapshot();
  }, AMBIENT_CAST_REFRESH_MS);

  cycleTimer = setInterval(() => {
    cycleIndex += 1;
    rebuildWalkers();
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
