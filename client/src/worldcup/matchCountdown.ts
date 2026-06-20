/**
 * World Cup soccer — pre-teleport kickoff countdown overlay (CLIENT-ONLY, FEATURE-FLAGGED).
 *
 * Shown in the origin room for a few seconds after a Challenge is accepted: a "{you} vs
 * {opponent}" line (identicons + flags) and a "Match starting in 3…2…1" counter, while both
 * players also flash a 🤝 handshake bubble (rendered via the normal chat-bubble path). When
 * the count reaches zero the server teleports both into the Match Pitch and this hides itself.
 * To deprecate, delete this file and the `worldcup`-tagged hooks in `main.ts`.
 */
import { identiconDataUrl } from "../game/identiconTexture.js";
import { createFlagImg } from "../ui/flags.js";

export interface MatchCountdownView {
  durationMs: number;
  selfAddress: string;
  selfCountry: string | null;
  opponentAddress: string;
  opponentCountry: string | null;
}

export class WorldcupMatchCountdown {
  private readonly root: HTMLDivElement;
  private readonly selfIdent: HTMLImageElement;
  private readonly selfFlag: HTMLSpanElement;
  private readonly oppIdent: HTMLImageElement;
  private readonly oppFlag: HTMLSpanElement;
  private readonly countEl: HTMLDivElement;
  private timer: number | null = null;
  private endsAt = 0;

  constructor() {
    const root = document.createElement("div");
    root.style.cssText =
      "position:fixed;left:50%;top:32%;transform:translate(-50%,-50%);z-index:90;display:none;" +
      "flex-direction:column;align-items:center;gap:0.5rem;pointer-events:none;" +
      "background:rgba(14,16,22,0.88);color:#f4f5f7;border:1px solid rgba(255,255,255,0.14);" +
      "border-radius:16px;padding:0.9rem 1.4rem;box-shadow:0 18px 48px rgba(0,0,0,0.5);" +
      "font-family:inherit;backdrop-filter:blur(8px);text-align:center;";

    const title = document.createElement("div");
    title.textContent = "1v1 Match";
    title.style.cssText =
      "font-size:0.66rem;letter-spacing:0.1em;text-transform:uppercase;opacity:0.65;";
    root.appendChild(title);

    const vs = document.createElement("div");
    vs.style.cssText =
      "display:flex;align-items:center;justify-content:center;gap:0.7rem;font-size:1.05rem;";
    const mkSide = (): {
      wrap: HTMLDivElement;
      ident: HTMLImageElement;
      flag: HTMLSpanElement;
    } => {
      const wrap = document.createElement("div");
      wrap.style.cssText = "display:flex;align-items:center;gap:0.35rem;";
      const flag = document.createElement("span");
      flag.style.cssText = "font-size:1.3rem;line-height:1;";
      const ident = document.createElement("img");
      ident.width = 30;
      ident.height = 30;
      ident.style.cssText = "width:30px;height:30px;border-radius:7px;";
      wrap.append(flag, ident);
      return { wrap, ident, flag };
    };
    const a = mkSide();
    const b = mkSide();
    // Opponent side mirrored (identicon then flag) so the two faces frame the "vs".
    b.wrap.style.flexDirection = "row-reverse";
    const vsLabel = document.createElement("span");
    vsLabel.textContent = "vs";
    vsLabel.style.cssText = "opacity:0.6;font-weight:700;";
    vs.append(a.wrap, vsLabel, b.wrap);
    root.appendChild(vs);
    this.selfIdent = a.ident;
    this.selfFlag = a.flag;
    this.oppIdent = b.ident;
    this.oppFlag = b.flag;

    const count = document.createElement("div");
    count.style.cssText =
      "font-size:2.4rem;font-weight:800;font-variant-numeric:tabular-nums;line-height:1;";
    root.appendChild(count);
    this.countEl = count;

    const caption = document.createElement("div");
    caption.textContent = "Match starting…";
    caption.style.cssText = "font-size:0.72rem;opacity:0.7;";
    root.appendChild(caption);

    document.body.appendChild(root);
    this.root = root;
  }

  show(v: MatchCountdownView): void {
    this.setFlag(this.selfFlag, v.selfCountry);
    this.setFlag(this.oppFlag, v.opponentCountry);
    void this.setIdent(this.selfIdent, v.selfAddress);
    void this.setIdent(this.oppIdent, v.opponentAddress);
    this.root.style.display = "flex";
    this.endsAt = performance.now() + Math.max(0, v.durationMs);
    this.tick();
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tick(), 200);
  }

  private tick(): void {
    const remainingMs = this.endsAt - performance.now();
    if (remainingMs <= 0) {
      this.countEl.textContent = "0";
      this.hide();
      return;
    }
    this.countEl.textContent = String(Math.ceil(remainingMs / 1000));
  }

  private setFlag(el: HTMLSpanElement, code: string | null): void {
    const img = code ? createFlagImg(code) : null;
    el.replaceChildren(img ?? document.createTextNode("\u{1F3F3}"));
  }

  private async setIdent(el: HTMLImageElement, address: string): Promise<void> {
    try {
      el.src = await identiconDataUrl(address);
    } catch {
      el.removeAttribute("src");
    }
  }

  hide(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.root.style.display = "none";
  }

  destroy(): void {
    this.hide();
    this.root.remove();
  }
}
