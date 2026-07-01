/**
 * World Cup soccer - 1v1 Match HUD (CLIENT-ONLY, FEATURE-FLAGGED, DEPRECATABLE).
 *
 * A flat bar pinned directly under the top HUD chrome (so it never overlaps the brand row):
 *
 *   {flag}{identicon}  scoreA · clock · scoreB  {identicon}{flag}        [Leave]
 *
 * Both flags + identicons identify the two sides; the local player's score is highlighted.
 * When the Match ends the scoreboard bar keeps the final score; a centre-screen **Match Result
 * Overlay** shows both identicons (winner full opacity, loser faded), a personalized headline,
 * final score, "Returning in N…" countdown, and a Leave button. Fed by `matchEnded`.
 * Shown only while the player is in a Match Pitch (participant or Spectator). To deprecate,
 * delete this file and the `worldcup`-tagged hooks in `main.ts`.
 */
import { identiconDataUrl } from "../game/identiconTexture.js";
import { createFlagImg } from "../ui/flags.js";

export type MatchPhase = "regulation" | "golden" | "ended";

export type MatchOutcome =
  | null
  | { result: "win"; winner: "a" | "b"; reason: "score" | "opponent_left" }
  | { result: "draw" };

export interface MatchStateView {
  matchId: string;
  scoreA: number;
  scoreB: number;
  phase: MatchPhase;
  remainingMs: number;
  kickoffRemainingMs: number;
  aAddress: string;
  bAddress: string;
  aCountry: string | null;
  bCountry: string | null;
}

function compact(addr: string): string {
  return addr.replace(/\s+/g, "").trim().toUpperCase();
}

function fmtClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface SideEls {
  wrap: HTMLDivElement;
  flag: HTMLSpanElement;
  ident: HTMLImageElement;
  score: HTMLSpanElement;
  /** address whose identicon is currently loaded, to avoid reloading on every update */
  loadedAddress: string;
}

export class WorldcupMatchHud {
  private readonly root: HTMLDivElement;
  private readonly bar: HTMLDivElement;
  private readonly sideA: SideEls;
  private readonly sideB: SideEls;
  private readonly centreEl: HTMLDivElement;
  private readonly leaveBtn: HTMLButtonElement;
  /** Centre-screen "GOAL!" banner + kickoff countdown overlay. */
  private readonly goalBanner: HTMLDivElement;
  private readonly goalTitle: HTMLDivElement;
  private readonly goalScore: HTMLDivElement;
  private readonly goalCount: HTMLDivElement;
  private goalTimer: number | null = null;
  private goalHideTimer: number | null = null;
  private goalKickoffEndsAt = 0;
  private goalKickoffEndHandler: (() => void) | null = null;
  /** Centre-screen Match Result Overlay (identicons + headline + countdown + Leave). */
  private readonly resultOverlay: HTMLDivElement;
  private readonly resultIdentA: HTMLImageElement;
  private readonly resultIdentB: HTMLImageElement;
  private readonly resultHeadline: HTMLDivElement;
  private readonly resultScore: HTMLDivElement;
  private readonly resultCountdown: HTMLDivElement;
  private readonly resultLeaveBtn: HTMLButtonElement;
  private resultTimer: number | null = null;
  private resultEndsAt = 0;
  /** Last-rendered side wallets, so the goal banner can tint when the local player scores. */
  private lastAAddress = "";
  private lastBAddress = "";
  private selfAddress = "";
  private topWrapObserver: ResizeObserver | null = null;
  /** Host sets this to forfeit + leave the Match. */
  onLeave: () => void = () => {};

  /**
   * @param parent where to mount the score bar (the `.letterbox` game area, so the bar is
   *   bounded to the rendered game width rather than the full viewport). Falls back to body.
   *   The centred goal banner always lives on `document.body` (full-screen overlay).
   */
  constructor(parent?: HTMLElement) {
    const root = document.createElement("div");
    root.className = "worldcup-match-hud";
    // Absolute (not fixed) so the bar spans the letterbox game area, not the whole viewport.
    root.style.cssText =
      "position:absolute;left:0;right:0;top:52px;z-index:60;display:none;pointer-events:none;";

    const bar = document.createElement("div");
    bar.style.cssText =
      "position:relative;width:100%;box-sizing:border-box;display:flex;align-items:center;" +
      "justify-content:center;gap:0.55rem;padding:5px 56px;min-height:34px;pointer-events:auto;" +
      "background:rgba(15,17,23,0.82);border-bottom:1px solid rgba(255,255,255,0.1);" +
      "box-shadow:0 2px 16px rgba(0,0,0,0.22);backdrop-filter:blur(10px);color:#f4f5f7;" +
      "font-family:inherit;font-size:1rem;font-variant-numeric:tabular-nums;";
    root.appendChild(bar);
    this.bar = bar;

    this.sideA = this.buildSide(false);
    this.sideB = this.buildSide(true);

    const centre = document.createElement("div");
    centre.style.cssText =
      "min-width:84px;text-align:center;font-weight:800;line-height:1.1;letter-spacing:0.01em;";
    centre.textContent = "0:00";
    this.centreEl = centre;

    bar.append(this.sideA.wrap, centre, this.sideB.wrap);

    const leaveBtn = document.createElement("button");
    leaveBtn.type = "button";
    leaveBtn.textContent = "Leave";
    leaveBtn.style.cssText =
      "position:absolute;right:8px;top:50%;transform:translateY(-50%);border:1px solid " +
      "rgba(255,255,255,0.18);background:rgba(255,255,255,0.07);border-radius:8px;" +
      "padding:0.2rem 0.55rem;font-size:0.74rem;cursor:pointer;color:#fff;";
    leaveBtn.addEventListener("click", () => this.onLeave());
    bar.appendChild(leaveBtn);
    this.leaveBtn = leaveBtn;

    (parent ?? document.body).appendChild(root);
    this.root = root;

    // Centre-screen goal banner ("GOAL!" + score, then "Kickoff in N"). Separate from the bar
    // so it can float over the pitch and fade itself out.
    const banner = document.createElement("div");
    banner.style.cssText =
      "position:fixed;left:50%;top:34%;transform:translate(-50%,-50%);z-index:92;display:none;" +
      "flex-direction:column;align-items:center;gap:0.35rem;pointer-events:none;text-align:center;" +
      "background:rgba(14,16,22,0.88);color:#f4f5f7;border:1px solid rgba(255,255,255,0.14);" +
      "border-radius:16px;padding:0.9rem 1.6rem;box-shadow:0 18px 48px rgba(0,0,0,0.5);" +
      "font-family:inherit;backdrop-filter:blur(8px);";
    const gTitle = document.createElement("div");
    gTitle.style.cssText =
      "font-size:2rem;font-weight:900;letter-spacing:0.04em;line-height:1;";
    const gScore = document.createElement("div");
    gScore.style.cssText =
      "font-size:1.2rem;font-weight:700;font-variant-numeric:tabular-nums;opacity:0.92;";
    const gCount = document.createElement("div");
    gCount.style.cssText = "font-size:0.78rem;opacity:0.7;min-height:1em;";
    banner.append(gTitle, gScore, gCount);
    document.body.appendChild(banner);
    this.goalBanner = banner;
    this.goalTitle = gTitle;
    this.goalScore = gScore;
    this.goalCount = gCount;

    const result = document.createElement("div");
    result.style.cssText =
      "position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:93;display:none;" +
      "flex-direction:column;align-items:center;gap:0.55rem;pointer-events:none;text-align:center;" +
      "background:rgba(14,16,22,0.9);color:#f4f5f7;border:1px solid rgba(255,255,255,0.14);" +
      "border-radius:18px;padding:1.1rem 1.8rem 1rem;min-width:240px;" +
      "box-shadow:0 18px 48px rgba(0,0,0,0.52);font-family:inherit;backdrop-filter:blur(10px);";
    const identRow = document.createElement("div");
    identRow.style.cssText = "display:flex;align-items:center;justify-content:center;gap:1.25rem;";
    const rIdentA = document.createElement("img");
    rIdentA.width = 64;
    rIdentA.height = 64;
    rIdentA.style.cssText =
      "width:64px;height:64px;border-radius:14px;transition:opacity 0.25s ease;";
    const rIdentB = document.createElement("img");
    rIdentB.width = 64;
    rIdentB.height = 64;
    rIdentB.style.cssText =
      "width:64px;height:64px;border-radius:14px;transition:opacity 0.25s ease;";
    identRow.append(rIdentA, rIdentB);
    const rHeadline = document.createElement("div");
    rHeadline.style.cssText =
      "font-size:1.45rem;font-weight:800;line-height:1.15;letter-spacing:0.01em;";
    const rScore = document.createElement("div");
    rScore.style.cssText =
      "font-size:1.15rem;font-weight:700;font-variant-numeric:tabular-nums;opacity:0.92;";
    const rCountdown = document.createElement("div");
    rCountdown.style.cssText = "font-size:0.82rem;opacity:0.72;min-height:1.1em;";
    const rLeave = document.createElement("button");
    rLeave.type = "button";
    rLeave.textContent = "Leave";
    rLeave.style.cssText =
      "pointer-events:auto;margin-top:0.15rem;border:1px solid rgba(255,255,255,0.2);" +
      "background:rgba(255,255,255,0.08);border-radius:10px;padding:0.35rem 0.85rem;" +
      "font-size:0.82rem;cursor:pointer;color:#fff;font-family:inherit;";
    rLeave.addEventListener("click", () => this.onLeave());
    result.append(identRow, rHeadline, rScore, rCountdown, rLeave);
    document.body.appendChild(result);
    this.resultOverlay = result;
    this.resultIdentA = rIdentA;
    this.resultIdentB = rIdentB;
    this.resultHeadline = rHeadline;
    this.resultScore = rScore;
    this.resultCountdown = rCountdown;
    this.resultLeaveBtn = rLeave;

    this.observeTopWrap();
  }

  /** One side cluster. `mirror` puts the identicon+flag on the right (B side) framing the centre. */
  private buildSide(mirror: boolean): SideEls {
    const wrap = document.createElement("div");
    wrap.style.cssText = `display:flex;align-items:center;gap:0.35rem;${
      mirror ? "flex-direction:row-reverse;" : ""
    }`;
    const flag = document.createElement("span");
    flag.style.cssText = "font-size:1.2rem;line-height:1;";
    const ident = document.createElement("img");
    ident.width = 24;
    ident.height = 24;
    ident.style.cssText = "width:24px;height:24px;border-radius:6px;";
    const score = document.createElement("span");
    score.style.cssText = "font-size:1.15rem;font-weight:700;min-width:0.9em;text-align:center;";
    score.textContent = "0";
    // Visual order: flag, identicon, score (mirrored for the B side via row-reverse).
    wrap.append(flag, ident, score);
    return { wrap, flag, ident, score, loadedAddress: "" };
  }

  /** Keep the bar pinned right below the measured top chrome height. */
  private observeTopWrap(): void {
    const topWrap = document.querySelector<HTMLElement>(".hud-top-wrap");
    const apply = (): void => {
      const h = topWrap?.offsetHeight ?? 52;
      this.root.style.top = `${h}px`;
    };
    apply();
    if (topWrap && "ResizeObserver" in window) {
      this.topWrapObserver = new ResizeObserver(apply);
      this.topWrapObserver.observe(topWrap);
    }
    window.addEventListener("resize", apply);
  }

  setSelfAddress(address: string): void {
    this.selfAddress = compact(address);
  }

  /** Which side the local player is on, or null if a Spectator. */
  private selfSide(a: string, b: string): "a" | "b" | null {
    if (compact(a) === this.selfAddress) return "a";
    if (compact(b) === this.selfAddress) return "b";
    return null;
  }

  private setFlag(el: HTMLSpanElement, code: string | null): void {
    const img = code ? createFlagImg(code) : null;
    el.replaceChildren(img ?? document.createTextNode("\u{1F3F3}"));
  }

  private setIdent(side: SideEls, address: string): void {
    const key = compact(address);
    if (side.loadedAddress === key) return;
    side.loadedAddress = key;
    void identiconDataUrl(address)
      .then((url) => {
        if (side.loadedAddress === key) side.ident.src = url;
      })
      .catch(() => {});
  }

  private renderSides(s: {
    aAddress: string;
    bAddress: string;
    aCountry: string | null;
    bCountry: string | null;
    scoreA: number;
    scoreB: number;
  }): void {
    this.lastAAddress = s.aAddress;
    this.lastBAddress = s.bAddress;
    const selfSide = this.selfSide(s.aAddress, s.bAddress);
    this.setFlag(this.sideA.flag, s.aCountry);
    this.setFlag(this.sideB.flag, s.bCountry);
    this.setIdent(this.sideA, s.aAddress);
    this.setIdent(this.sideB, s.bAddress);
    this.sideA.score.textContent = String(s.scoreA);
    this.sideB.score.textContent = String(s.scoreB);
    this.sideA.score.style.color = selfSide === "a" ? "#18e0ff" : "";
    this.sideB.score.style.color = selfSide === "b" ? "#18e0ff" : "";
  }

  update(s: MatchStateView): void {
    this.root.style.display = "block";
    // Participants forfeit on Leave; Spectators just stop watching (both via leaveMatch).
    this.leaveBtn.style.display = "block";
    this.leaveBtn.textContent = this.selfSide(s.aAddress, s.bAddress)
      ? "Leave"
      : "Stop watching";
    this.renderSides(s);
    this.centreEl.textContent = fmtClock(s.remainingMs);
    this.centreEl.style.color = s.phase === "golden" ? "#ffd23f" : "#f4f5f7";
    this.centreEl.title = s.phase === "golden" ? "Golden Goal" : "";
  }

  private headlineForResult(
    outcome: MatchOutcome,
    side: "a" | "b" | null
  ): { text: string; color: string } {
    if (!outcome) {
      return { text: "Full time", color: "#f4f5f7" };
    }
    if (outcome.result === "draw") {
      return { text: "Draw", color: "#cbd2dc" };
    }
    const won = side !== null && outcome.winner === side;
    if (side === null) {
      return {
        text: `Side ${outcome.winner.toUpperCase()} wins`,
        color: "#f4f5f7",
      };
    }
    if (outcome.reason === "opponent_left") {
      return {
        text: won ? "You win - opponent left" : "You lost - opponent left",
        color: won ? "#5fe08a" : "#ff8a8a",
      };
    }
    return {
      text: won ? "You win!" : "You lost",
      color: won ? "#5fe08a" : "#ff8a8a",
    };
  }

  private setResultIdent(
    el: HTMLImageElement,
    address: string,
    opacity: number
  ): void {
    el.style.opacity = String(opacity);
    const key = compact(address);
    void identiconDataUrl(address)
      .then((url) => {
        if (compact(address) === key) el.src = url;
      })
      .catch(() => {});
  }

  private hideResultOverlay(): void {
    if (this.resultTimer !== null) {
      window.clearInterval(this.resultTimer);
      this.resultTimer = null;
    }
    this.resultOverlay.style.display = "none";
  }

  showResult(
    outcome: MatchOutcome,
    scoreA: number,
    scoreB: number,
    aAddress: string,
    bAddress: string,
    aCountry: string | null,
    bCountry: string | null,
    resultLingerMs: number
  ): void {
    this.hideGoal();
    this.hideResultOverlay();
    this.root.style.display = "block";
    this.leaveBtn.style.display = "none";
    this.renderSides({ aAddress, bAddress, aCountry, bCountry, scoreA, scoreB });
    this.centreEl.textContent = "FT";
    this.centreEl.style.color = "#cbd2dc";
    this.centreEl.title = "";

    const side = this.selfSide(aAddress, bAddress);
    const { text, color } = this.headlineForResult(outcome, side);
    this.resultHeadline.textContent = text;
    this.resultHeadline.style.color = color;
    this.resultScore.textContent = `${scoreA} – ${scoreB}`;

    const loserOpacity = 0.35;
    if (!outcome || outcome.result === "draw") {
      this.setResultIdent(this.resultIdentA, aAddress, 1);
      this.setResultIdent(this.resultIdentB, bAddress, 1);
    } else {
      const winner = outcome.winner;
      this.setResultIdent(this.resultIdentA, aAddress, winner === "a" ? 1 : loserOpacity);
      this.setResultIdent(this.resultIdentB, bAddress, winner === "b" ? 1 : loserOpacity);
    }

    this.resultLeaveBtn.textContent = side ? "Leave" : "Stop watching";
    this.resultOverlay.style.display = "flex";

    const linger = Math.max(1000, resultLingerMs);
    this.resultEndsAt = performance.now() + linger;
    const tick = (): void => {
      const remaining = this.resultEndsAt - performance.now();
      if (remaining <= 0) {
        this.resultCountdown.textContent = "Returning…";
        this.hideResultOverlay();
        return;
      }
      this.resultCountdown.textContent = `Returning in ${Math.ceil(remaining / 1000)}…`;
    };
    tick();
    this.resultTimer = window.setInterval(tick, 200);
  }

  /**
   * Flash a "GOAL!" banner with the scoring side's flag + new score. When `kickoffMs > 0` it then
   * counts down "Kickoff in N" (movement is frozen server-side for that window); otherwise it just
   * lingers briefly (the goal that ended the Match - `showResult` follows).
   */
  flashGoal(
    side: "a" | "b",
    scoreA: number,
    scoreB: number,
    country: string | null,
    kickoffMs: number,
    onKickoffEnd?: () => void
  ): void {
    if (this.goalTimer !== null) window.clearInterval(this.goalTimer);
    if (this.goalHideTimer !== null) window.clearTimeout(this.goalHideTimer);
    this.goalTimer = null;
    this.goalHideTimer = null;
    this.goalKickoffEndHandler = onKickoffEnd ?? null;

    const flagImg = country ? createFlagImg(country) : null;
    this.goalTitle.replaceChildren();
    if (flagImg) {
      this.goalTitle.appendChild(flagImg);
      this.goalTitle.appendChild(document.createTextNode(" "));
    }
    this.goalTitle.appendChild(document.createTextNode("GOAL!"));
    this.goalTitle.style.color = side === this.selfSide(this.lastAAddress, this.lastBAddress)
      ? "#5fe08a"
      : "#f4f5f7";
    this.goalScore.textContent = `${scoreA} – ${scoreB}`;
    this.goalBanner.style.display = "flex";

    if (kickoffMs > 0) {
      this.goalKickoffEndsAt = performance.now() + kickoffMs;
      const tick = (): void => {
        const remaining = this.goalKickoffEndsAt - performance.now();
        if (remaining <= 0) {
          this.hideGoal();
          return;
        }
        this.goalCount.textContent = `Kickoff in ${Math.ceil(remaining / 1000)}…`;
      };
      tick();
      this.goalTimer = window.setInterval(tick, 200);
    } else {
      this.goalCount.textContent = "";
      this.goalHideTimer = window.setTimeout(() => this.hideGoal(), 2000);
    }
  }

  private hideGoal(): void {
    if (this.goalTimer !== null) {
      window.clearInterval(this.goalTimer);
      this.goalTimer = null;
    }
    if (this.goalHideTimer !== null) {
      window.clearTimeout(this.goalHideTimer);
      this.goalHideTimer = null;
    }
    this.goalBanner.style.display = "none";
    const end = this.goalKickoffEndHandler;
    this.goalKickoffEndHandler = null;
    end?.();
  }

  hide(): void {
    this.root.style.display = "none";
    this.hideGoal();
    this.hideResultOverlay();
  }

  /** Root element for layout stacking (Movement Mode Toggle sits below this bar). */
  get layoutRoot(): HTMLDivElement {
    return this.root;
  }

  /** True while the scoreboard bar is shown (participants and Spectators). */
  isBarVisible(): boolean {
    return this.root.style.display !== "none";
  }

  destroy(): void {
    this.topWrapObserver?.disconnect();
    this.hideGoal();
    this.hideResultOverlay();
    this.resultOverlay.remove();
    this.goalBanner.remove();
    this.root.remove();
  }
}
