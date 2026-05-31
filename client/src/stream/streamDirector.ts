import type { Game } from "../game/Game.js";
import { walletDisplayName } from "../walletDisplayName.js";

const OVERVIEW_MS = 45_000;
/** Hold on the followed player in isometric view. */
const SPOTLIGHT_MS = 30_000;
/** Top-down ↔ isometric + zoom transition duration. */
const TRANSITION_MS = 2500;

export type StreamFollowBarState = {
  visible: boolean;
  playerName?: string;
  /** 1 = full bar, 0 = empty (draining). */
  progress?: number;
};

export type StreamDirectorOptions = {
  game: Game;
  /** Stream bot wallet — excluded from random spotlight picks. */
  selfAddress: string;
  /** Slow top-down pan between spotlights; set false for `?noScroll=1`. */
  panOverview?: boolean;
  onFollowBar?: (state: StreamFollowBarState) => void;
};

type FollowablePlayer = {
  address: string;
  displayName: string;
  x: number;
  y: number;
  z: number;
};

export class StreamDirector {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private followBarStartTimer: ReturnType<typeof setTimeout> | null = null;
  private followBarRaf: number | null = null;

  constructor(private readonly opts: StreamDirectorOptions) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.beginOverviewPan(true);
    this.scheduleSpotlightTimer();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.followBarStartTimer !== null) {
      clearTimeout(this.followBarStartTimer);
      this.followBarStartTimer = null;
    }
    this.clearFollowBarAnimation();
    this.opts.onFollowBar?.({ visible: false });
    this.opts.game.animateStreamCameraPoseTo(0, 0);
  }

  /** Resume top-down pan; optionally snap look-at to room center (first start only). */
  private beginOverviewPan(resetLookAt: boolean): void {
    const { game } = this.opts;
    game.setStreamCameraMode("detached");
    game.animateStreamCameraPoseTo(0, 0);
    game.animateZoomFrustumTo(game.getStreamOverviewFrustumSize(), 0);
    if (resetLookAt) {
      const center = game.getRoomLookAtCenter();
      game.setCameraLookAtTarget(center.x, center.y, center.z, { instant: true });
    }
    if (this.opts.panOverview !== false) {
      game.setStreamPanEnabled(true, { resetLookAt });
    } else {
      game.setStreamPanEnabled(false);
    }
  }

  private scheduleSpotlightTimer(): void {
    if (!this.running) return;
    const players = this.followableRemotePlayers();
    const waitMs =
      players.length > 0 ? OVERVIEW_MS : OVERVIEW_MS + OVERVIEW_MS / 2;

    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.running) return;
      const pick = this.pickRandom(players);
      if (!pick) {
        this.beginOverviewPan(false);
        this.scheduleSpotlightTimer();
        return;
      }
      this.startSpotlight(pick);
    }, waitMs);
  }

  private startSpotlight(player: FollowablePlayer): void {
    if (!this.running) return;
    const { game } = this.opts;
    const bounds = game.getZoomBounds();
    const spotlightZoom = bounds.min * 1.15;
    const playerName =
      player.displayName.trim() || walletDisplayName(player.address);

    game.setStreamPanEnabled(false);
    game.setStreamCameraMode("followAddress", player.address);
    game.setCameraLookAtTarget(player.x, player.y, player.z, { instant: true });
    game.animateStreamCameraPoseTo(1, TRANSITION_MS);
    game.animateZoomFrustumTo(spotlightZoom, TRANSITION_MS);

    this.followBarStartTimer = setTimeout(() => {
      this.followBarStartTimer = null;
      if (!this.running) return;
      this.startFollowBarDrain(playerName);
    }, TRANSITION_MS);

    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.running) return;
      this.endSpotlight();
    }, TRANSITION_MS + SPOTLIGHT_MS);
  }

  private startFollowBarDrain(playerName: string): void {
    this.clearFollowBarAnimation();
    const startedAt = performance.now();
    const tick = (): void => {
      if (!this.running) return;
      const elapsed = performance.now() - startedAt;
      const progress = Math.max(0, 1 - elapsed / SPOTLIGHT_MS);
      this.opts.onFollowBar?.({ visible: true, playerName, progress });
      if (progress <= 0) {
        this.followBarRaf = null;
        return;
      }
      this.followBarRaf = requestAnimationFrame(tick);
    };
    this.opts.onFollowBar?.({ visible: true, playerName, progress: 1 });
    this.followBarRaf = requestAnimationFrame(tick);
  }

  private clearFollowBarAnimation(): void {
    if (this.followBarRaf !== null) {
      cancelAnimationFrame(this.followBarRaf);
      this.followBarRaf = null;
    }
  }

  private endSpotlight(): void {
    if (!this.running) return;
    const { game } = this.opts;
    this.clearFollowBarAnimation();
    this.opts.onFollowBar?.({ visible: false });
    game.expandStreamViewInterestForOverview();
    game.setStreamCameraMode("detached");
    game.animateStreamCameraPoseTo(0, TRANSITION_MS);
    game.animateZoomFrustumTo(game.getStreamOverviewFrustumSize(), TRANSITION_MS);

    this.timer = setTimeout(() => {
      this.timer = null;
      if (!this.running) return;
      this.beginOverviewPan(false);
      this.scheduleSpotlightTimer();
    }, TRANSITION_MS);
  }

  private followableRemotePlayers(): FollowablePlayer[] {
    const self = this.opts.selfAddress.replace(/\s+/g, "").trim().toUpperCase();
    return this.opts.game.listFollowablePlayers().filter((p) => {
      const k = p.address.replace(/\s+/g, "").trim().toUpperCase();
      return k && k !== self;
    });
  }

  private pickRandom(players: FollowablePlayer[]): FollowablePlayer | null {
    if (players.length === 0) return null;
    return players[Math.floor(Math.random() * players.length)] ?? null;
  }
}
