/**
 * World Cup soccer — in-room scoreboard HUD (seasonal, deletable).
 *
 * A small fixed panel listing the leading countries, plus a flag button that opens the
 * country picker. Shown only in the field room. Fully self-contained (inline styles).
 */
import { countryName, flagEmoji } from "./countries.js";
import { showCountryPickerModal } from "./countryPickerModal.js";

export type CountryGoals = { code: string; goals: number };

/** localStorage key remembering the player's last collapse choice across rooms/sessions. */
const COLLAPSE_KEY = "wc_scoreboard_collapsed";

export class WorldcupScoreboard {
  private readonly root: HTMLDivElement;
  private readonly subtitleEl: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly championEl: HTMLDivElement;
  private readonly flagBtn: HTMLButtonElement;
  private readonly titleEl: HTMLDivElement;
  private readonly chevronEl: HTMLSpanElement;
  private topCountries: CountryGoals[] = [];
  private selfCountry: string | null = null;
  private prevWinner: string | null = null;
  private visible = false;
  private collapsed = false;
  /** Set by the host to send the chosen country to the server. */
  onChangeCountry: (code: string) => void = () => {};

  /**
   * @param parent where to mount (the `.letterbox` game area, so the panel is bounded to the
   *   rendered game and never spills into the black letterbox bars). Falls back to body.
   */
  constructor(parent?: HTMLElement) {
    const root = document.createElement("div");
    // Absolute (not fixed) so it anchors to the letterbox game area, not the viewport. Width is
    // responsive so it never crowds the top toolbar on narrow screens.
    root.style.cssText =
      "position:absolute;top:72px;right:12px;z-index:60;width:min(220px,46vw);max-width:220px;box-sizing:border-box;background:rgba(18,20,25,0.86);color:#f4f5f7;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:0.6rem 0.7rem;box-shadow:0 10px 30px rgba(0,0,0,0.4);font-family:inherit;backdrop-filter:blur(6px);display:none;";

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;gap:0.5rem;";
    // The title + chevron form the collapse toggle; the flag button is separate.
    const toggle = document.createElement("div");
    toggle.style.cssText =
      "display:flex;align-items:center;gap:0.35rem;cursor:pointer;flex:1 1 auto;min-width:0;";
    toggle.title = "Tap to expand/collapse";
    const title = document.createElement("div");
    title.textContent = "⚽ World Cup";
    title.style.cssText =
      "font-weight:700;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    const chevron = document.createElement("span");
    chevron.style.cssText = "font-size:0.7rem;opacity:0.7;line-height:1;";
    toggle.append(title, chevron);
    toggle.addEventListener("click", () => this.setCollapsed(!this.collapsed));
    header.appendChild(toggle);
    this.titleEl = title;
    this.chevronEl = chevron;

    const flagBtn = document.createElement("button");
    flagBtn.type = "button";
    flagBtn.title = "Pick your country";
    flagBtn.style.cssText =
      "border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);border-radius:8px;padding:0.15rem 0.4rem;font-size:1.1rem;line-height:1;cursor:pointer;color:#fff;flex:0 0 auto;";
    flagBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // never toggles collapse
      this.openPicker();
    });
    header.appendChild(flagBtn);
    this.flagBtn = flagBtn;
    root.appendChild(header);

    const subtitle = document.createElement("div");
    subtitle.textContent = "Today · resets 00:00 UTC";
    subtitle.style.cssText =
      "font-size:0.68rem;opacity:0.55;margin:0.35rem 0 0.45rem;";
    root.appendChild(subtitle);
    this.subtitleEl = subtitle;

    const listEl = document.createElement("div");
    listEl.style.cssText = "display:flex;flex-direction:column;gap:0.2rem;";
    root.appendChild(listEl);
    this.listEl = listEl;

    const championEl = document.createElement("div");
    championEl.style.cssText =
      "margin-top:0.5rem;padding-top:0.45rem;border-top:1px solid rgba(255,255,255,0.12);font-size:0.78rem;opacity:0.85;display:none;";
    root.appendChild(championEl);
    this.championEl = championEl;

    (parent ?? document.body).appendChild(root);
    this.root = root;
    this.collapsed = this.loadCollapsed();
    this.renderFlagButton();
    this.renderList();
    this.renderChampion();
    this.applyCollapsed();
  }

  private loadCollapsed(): boolean {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  }

  setCollapsed(collapsed: boolean): void {
    this.collapsed = collapsed;
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* private mode / storage disabled: just keep the in-memory state */
    }
    this.applyCollapsed();
  }

  /** Show/hide the body and swap the title between full and a compact leader summary. */
  private applyCollapsed(): void {
    const hidden = this.collapsed ? "none" : "";
    this.subtitleEl.style.display = hidden;
    this.listEl.style.display = this.collapsed ? "none" : "flex";
    this.chevronEl.textContent = this.collapsed ? "▸" : "▾";
    if (this.collapsed) {
      const leader = this.topCountries[0] ?? null;
      this.titleEl.textContent = leader
        ? `⚽ ${flagEmoji(leader.code)} ${leader.goals}`
        : "⚽ World Cup";
      this.championEl.style.display = "none";
    } else {
      this.titleEl.textContent = "⚽ World Cup";
      this.renderChampion();
    }
  }

  openPicker(opts?: { prompt?: string; dismissable?: boolean }): void {
    showCountryPickerModal({
      currentCode: this.selfCountry,
      prompt: opts?.prompt,
      dismissable: opts?.dismissable,
      onPick: (code) => {
        this.selfCountry = code;
        this.renderFlagButton();
        this.onChangeCountry(code);
      },
    });
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.style.display = visible ? "block" : "none";
  }

  isVisible(): boolean {
    return this.visible;
  }

  setSelfCountry(code: string | null): void {
    this.selfCountry = code ? code.toUpperCase() : null;
    this.renderFlagButton();
  }

  getSelfCountry(): string | null {
    return this.selfCountry;
  }

  setLeaderboard(top: CountryGoals[]): void {
    this.topCountries = [...top].sort((a, b) => b.goals - a.goals);
    this.renderList();
    if (this.collapsed) this.applyCollapsed(); // refresh the compact leader summary
  }

  /** Previous UTC day's winning country (the flag the crowd celebrates), or null. */
  setPreviousWinner(code: string | null): void {
    this.prevWinner = code ? code.toUpperCase() : null;
    this.renderChampion();
  }

  private renderChampion(): void {
    if (this.collapsed) {
      this.championEl.style.display = "none";
      return;
    }
    if (!this.prevWinner) {
      this.championEl.style.display = "none";
      this.championEl.textContent = "";
      return;
    }
    this.championEl.style.display = "block";
    this.championEl.textContent = `🏆 Yesterday: ${flagEmoji(
      this.prevWinner
    )} ${countryName(this.prevWinner)}`;
  }

  private renderFlagButton(): void {
    this.flagBtn.textContent = this.selfCountry
      ? flagEmoji(this.selfCountry)
      : "🏳️";
  }

  private renderList(): void {
    this.listEl.textContent = "";
    if (this.topCountries.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No goals yet — be the first!";
      empty.style.cssText = "font-size:0.8rem;opacity:0.65;";
      this.listEl.appendChild(empty);
      return;
    }
    let rank = 0;
    for (const c of this.topCountries.slice(0, 8)) {
      rank += 1;
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;gap:0.45rem;font-size:0.85rem;";
      const r = document.createElement("span");
      r.textContent = `${rank}`;
      r.style.cssText = "width:1.1rem;opacity:0.55;text-align:right;";
      const flag = document.createElement("span");
      flag.textContent = flagEmoji(c.code);
      flag.style.cssText = "font-size:1.05rem;line-height:1;";
      const name = document.createElement("span");
      name.textContent = countryName(c.code);
      name.style.cssText =
        "flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      const goals = document.createElement("span");
      goals.textContent = String(c.goals);
      goals.style.cssText = "font-weight:700;";
      row.append(r, flag, name, goals);
      this.listEl.appendChild(row);
    }
  }

  /** Brief centered celebration banner. */
  flashGoal(scorerName: string | null, country: string | null): void {
    const banner = document.createElement("div");
    const flag = country ? `${flagEmoji(country)} ` : "";
    const who = scorerName ? ` — ${scorerName}` : "";
    banner.textContent = `⚽ GOAL! ${flag}${who}`.trim();
    banner.style.cssText =
      "position:fixed;top:18%;left:50%;z-index:120;background:rgba(16,18,22,0.92);color:#fff;border:1px solid rgba(255,255,255,0.18);border-radius:14px;padding:0.7rem 1.2rem;font-size:1.3rem;font-weight:800;letter-spacing:0.02em;box-shadow:0 16px 50px rgba(0,0,0,0.5);pointer-events:none;transition:opacity 0.5s ease, transform 0.5s ease;opacity:0;font-family:inherit;";
    banner.style.transform = "translate(-50%, 8px)";
    document.body.appendChild(banner);
    requestAnimationFrame(() => {
      banner.style.opacity = "1";
      banner.style.transform = "translate(-50%, 0)";
    });
    setTimeout(() => {
      banner.style.opacity = "0";
      banner.style.transform = "translate(-50%, -8px)";
      setTimeout(() => banner.remove(), 550);
    }, 1900);
  }

  destroy(): void {
    this.root.remove();
  }
}
