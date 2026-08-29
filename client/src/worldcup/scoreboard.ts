/**
 * World Cup soccer - in-room scoreboard HUD (seasonal, deletable).
 *
 * Desktop: a small fixed panel listing the leading countries, plus a flag button that opens
 * the country picker. Mobile / coarse pointer: a compact Scoreboard Chip showing only the
 * day's high score (`1. {flag} {goals}`); tapping it opens the Leaderboard Modal. The picker
 * is not on the chip. Shown only in the field room. Fully self-contained (inline styles).
 */
import { countryName } from "./countries.js";
import { showCountryPickerModal } from "./countryPickerModal.js";
import { createFlagImg } from "../ui/flags.js";
import { t } from "@nspace/i18n";
import {
  leadingCountryChip,
  rankCountryGoals,
  SCOREBOARD_CHIP_MEDIA,
  scoreboardChipMediaMatches,
  type CountryGoals,
} from "./scoreboardView.js";

export type { CountryGoals };

/** Duck-typed overlay-back stack so Android back closes the Leaderboard Modal. */
export type ScoreboardOverlayBack = {
  push(id: string, onPop: () => boolean | void): void;
  dismiss(id: string): void;
};

export type WorldcupScoreboardOptions = {
  /** Injected in tests; production uses the chip media query. */
  usesChip?: () => boolean;
  overlayBack?: ScoreboardOverlayBack;
};

/** localStorage key remembering the player's last collapse choice across rooms/sessions. */
const COLLAPSE_KEY = "wc_scoreboard_collapsed";
const LEADERBOARD_OVERLAY_ID = "worldcup-leaderboard";

export class WorldcupScoreboard {
  private readonly root: HTMLDivElement;
  private readonly header: HTMLElement;
  private readonly toggle: HTMLElement;
  private readonly subtitleEl: HTMLDivElement;
  private readonly listEl: HTMLDivElement;
  private readonly championEl: HTMLDivElement;
  private readonly flagBtn: HTMLButtonElement;
  private readonly titleEl: HTMLDivElement;
  private readonly chevronEl: HTMLSpanElement;
  private readonly usesChipFn: () => boolean;
  private readonly overlayBack?: ScoreboardOverlayBack;
  private readonly media: MediaQueryList | null;
  private topCountries: CountryGoals[] = [];
  private selfCountry: string | null = null;
  private prevWinner: string | null = null;
  private visible = false;
  private collapsed = false;
  private chipLayout = false;
  private modal: HTMLDivElement | null = null;
  private modalList: HTMLDivElement | null = null;
  private modalChampion: HTMLDivElement | null = null;
  /** Set by the host to send the chosen country to the server. */
  onChangeCountry: (code: string) => void = () => {};

  /**
   * @param parent where to mount (the `.letterbox` game area, so the panel is bounded to the
   *   rendered game and never spills into the black letterbox bars). Falls back to body.
   */
  constructor(parent?: HTMLElement, opts?: WorldcupScoreboardOptions) {
    this.usesChipFn = opts?.usesChip ?? scoreboardChipMediaMatches;
    this.overlayBack = opts?.overlayBack;

    const root = document.createElement("div");
    // Absolute (not fixed) so it anchors to the letterbox game area, not the viewport. Width is
    // responsive so it never crowds the top toolbar on narrow screens. `top` is anchored to the
    // measured top-chrome height (brand row + login-streak marquee) plus room for the
    // top-right "Return Home" button below it, so the panel never covers the header menu or
    // the Return Home control (which lives in the same top-right corner).
    root.style.cssText =
      "position:absolute;top:calc(var(--hud-below-top-wrap, 52px) + 48px);right:12px;z-index:60;width:min(220px,46vw);max-width:220px;box-sizing:border-box;background:rgba(18,20,25,0.86);color:#f4f5f7;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:0.6rem 0.7rem;box-shadow:0 10px 30px rgba(0,0,0,0.4);font-family:inherit;backdrop-filter:blur(6px);display:none;user-select:none;-webkit-user-select:none;";

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;align-items:center;justify-content:space-between;gap:0.5rem;";
    // The title + chevron form the collapse toggle (desktop) or Scoreboard Chip (mobile).
    const toggle = document.createElement("div");
    toggle.style.cssText =
      "display:flex;align-items:center;gap:0.35rem;cursor:pointer;flex:1 1 auto;min-width:0;min-height:44px;";
    toggle.title = "Tap to expand/collapse";
    const title = document.createElement("div");
    title.textContent = "⚽ World Cup";
    title.style.cssText =
      "font-weight:700;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:inline-flex;align-items:center;gap:0.25rem;";
    const chevron = document.createElement("span");
    chevron.style.cssText = "font-size:0.7rem;opacity:0.7;line-height:1;";
    toggle.append(title, chevron);
    toggle.addEventListener("click", () => {
      if (this.chipLayout) this.openLeaderboardModal();
      else this.setCollapsed(!this.collapsed);
    });
    toggle.addEventListener("keydown", (e) => {
      if (!this.chipLayout) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.openLeaderboardModal();
      }
    });
    header.appendChild(toggle);
    this.header = header;
    this.toggle = toggle;
    this.titleEl = title;
    this.chevronEl = chevron;

    const flagBtn = document.createElement("button");
    flagBtn.type = "button";
    flagBtn.title = "Pick your country";
    flagBtn.style.cssText =
      "border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);border-radius:8px;padding:0.15rem 0.4rem;font-size:1.1rem;line-height:1;cursor:pointer;color:#fff;flex:0 0 auto;min-width:44px;min-height:44px;";
    flagBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // never toggles collapse / never opens the Leaderboard Modal
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
    this.media =
      opts?.usesChip || typeof window.matchMedia !== "function"
        ? null
        : window.matchMedia(SCOREBOARD_CHIP_MEDIA);
    this.media?.addEventListener("change", this.onMediaChange);
    window.addEventListener("resize", this.onMediaChange);
    this.renderFlagButton();
    this.refreshLayout();
  }

  private readonly onMediaChange = (): void => {
    this.refreshLayout();
  };

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
    this.applyBody();
  }

  private refreshLayout(): void {
    const wasChip = this.chipLayout;
    this.chipLayout = this.usesChipFn();
    if (wasChip && !this.chipLayout) this.closeLeaderboardModal();
    this.applyChipChrome();
    this.applyBody();
  }

  private applyChipChrome(): void {
    if (this.chipLayout) {
      this.root.style.width = "auto";
      this.root.style.maxWidth = "min(220px, 72vw)";
      this.root.style.padding = "0.28rem 0.4rem";
      this.chevronEl.style.display = "none";
      this.toggle.setAttribute("role", "button");
      this.toggle.tabIndex = 0;
      this.toggle.setAttribute("aria-label", t("worldcup.scoreboardChipAria"));
      this.toggle.title = t("worldcup.scoreboardChipTitle");
      this.flagBtn.remove();
    } else {
      this.root.style.width = "min(220px,46vw)";
      this.root.style.maxWidth = "220px";
      this.root.style.padding = "0.6rem 0.7rem";
      this.chevronEl.style.display = "";
      this.toggle.removeAttribute("role");
      this.toggle.removeAttribute("tabindex");
      this.toggle.removeAttribute("aria-label");
      this.toggle.title = "Tap to expand/collapse";
      if (!this.flagBtn.isConnected) this.header.appendChild(this.flagBtn);
    }
  }

  /** Show/hide the body and swap the title between full, collapsed, and Scoreboard Chip. */
  private applyBody(): void {
    const compact = this.chipLayout || this.collapsed;
    this.subtitleEl.style.display = compact ? "none" : "";
    this.listEl.style.display = compact ? "none" : "flex";
    this.chevronEl.textContent = this.collapsed && !this.chipLayout ? "▸" : "▾";
    if (this.chipLayout) {
      this.renderChipTitle();
      this.championEl.style.display = "none";
      this.championEl.textContent = "";
      this.listEl.textContent = "";
      return;
    }
    if (this.collapsed) {
      this.renderCollapsedTitle();
      this.championEl.style.display = "none";
      this.championEl.textContent = "";
    } else {
      this.titleEl.textContent = "⚽ World Cup";
      this.renderList();
      this.renderChampion();
    }
  }

  private renderChipTitle(): void {
    const leader = leadingCountryChip(this.topCountries);
    this.titleEl.replaceChildren(document.createTextNode("1. "));
    if (leader) {
      this.titleEl.append(
        createFlagImg(leader.code) ?? document.createTextNode(""),
        document.createTextNode(` ${leader.goals}`)
      );
    } else {
      this.titleEl.appendChild(document.createTextNode("—"));
    }
  }

  private renderCollapsedTitle(): void {
    const leader = leadingCountryChip(this.topCountries);
    if (leader) {
      this.titleEl.replaceChildren(
        document.createTextNode("⚽ "),
        createFlagImg(leader.code) ?? document.createTextNode(""),
        document.createTextNode(` ${leader.goals}`)
      );
    } else {
      this.titleEl.textContent = "⚽ World Cup";
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
    if (!visible) this.closeLeaderboardModal();
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
    this.applyBody();
    if (this.modal) this.renderModalBody();
  }

  /** Previous UTC day's winning country (the flag the crowd celebrates), or null. */
  setPreviousWinner(code: string | null): void {
    this.prevWinner = code ? code.toUpperCase() : null;
    this.renderChampion();
    if (this.modal) this.renderModalBody();
  }

  private renderChampion(): void {
    if (this.chipLayout || this.collapsed) {
      this.championEl.style.display = "none";
      this.championEl.textContent = "";
      return;
    }
    this.fillChampion(this.championEl);
  }

  private fillChampion(el: HTMLElement): void {
    if (!this.prevWinner) {
      el.style.display = "none";
      el.textContent = "";
      return;
    }
    el.style.display = "block";
    el.replaceChildren(
      document.createTextNode("🏆 Yesterday: "),
      createFlagImg(this.prevWinner) ?? document.createTextNode(""),
      document.createTextNode(` ${countryName(this.prevWinner)}`)
    );
  }

  private renderFlagButton(): void {
    const img = this.selfCountry ? createFlagImg(this.selfCountry) : null;
    this.flagBtn.replaceChildren(img ?? document.createTextNode("🏳️"));
  }

  private renderList(): void {
    this.fillRankedList(this.listEl);
  }

  private fillRankedList(listEl: HTMLElement): void {
    listEl.textContent = "";
    const ranked = rankCountryGoals(this.topCountries);
    if (ranked.length === 0) {
      const empty = document.createElement("div");
      empty.textContent = "No goals yet - be the first!";
      empty.style.cssText = "font-size:0.8rem;opacity:0.65;";
      listEl.appendChild(empty);
      return;
    }
    for (const c of ranked) {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;gap:0.45rem;font-size:0.85rem;";
      const r = document.createElement("span");
      r.textContent = `${c.rank}`;
      r.style.cssText = "width:1.1rem;opacity:0.55;text-align:right;";
      const flag = document.createElement("span");
      flag.style.cssText =
        "font-size:1.05rem;line-height:1;display:inline-flex;align-items:center;";
      flag.appendChild(createFlagImg(c.code) ?? document.createTextNode("🏳️"));
      const name = document.createElement("span");
      name.textContent = countryName(c.code);
      name.style.cssText =
        "flex:1 1 auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
      const goals = document.createElement("span");
      goals.textContent = String(c.goals);
      goals.style.cssText = "font-weight:700;font-variant-numeric:tabular-nums;";
      row.append(r, flag, name, goals);
      listEl.appendChild(row);
    }
  }

  openLeaderboardModal(): void {
    if (this.modal) {
      this.renderModalBody();
      return;
    }

    const wrap = document.createElement("div");
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-modal", "true");
    wrap.setAttribute("aria-label", t("worldcup.leaderboardTitle"));
    wrap.style.cssText =
      "position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:2147483645;display:flex;align-items:center;justify-content:center;padding:max(1rem, env(safe-area-inset-top)) max(1rem, env(safe-area-inset-right)) max(1rem, env(safe-area-inset-bottom)) max(1rem, env(safe-area-inset-left));box-sizing:border-box;font-family:inherit;backdrop-filter:blur(6px);user-select:none;-webkit-user-select:none;";

    const card = document.createElement("div");
    card.style.cssText =
      "background:rgba(16,18,22,0.96);color:#f4f5f7;border:1px solid rgba(255,255,255,0.12);border-radius:14px;width:min(420px,94vw);max-height:80vh;display:flex;flex-direction:column;box-shadow:0 18px 60px rgba(0,0,0,0.5);overflow:hidden;";

    const header = document.createElement("div");
    header.style.cssText =
      "display:flex;align-items:flex-start;justify-content:space-between;gap:0.75rem;padding:1rem 1rem 0.35rem;";
    const heading = document.createElement("div");
    const title = document.createElement("h2");
    title.textContent = t("worldcup.leaderboardTitle");
    title.style.cssText = "margin:0;font-size:1.05rem;font-weight:700;";
    const subtitle = document.createElement("p");
    subtitle.textContent = "Today · resets 00:00 UTC";
    subtitle.style.cssText =
      "margin:0.3rem 0 0;font-size:0.75rem;opacity:0.55;";
    heading.append(title, subtitle);
    header.appendChild(heading);

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", t("worldcup.leaderboardClose"));
    closeBtn.textContent = "✕";
    closeBtn.style.cssText =
      "border:1px solid rgba(255,255,255,0.18);background:rgba(255,255,255,0.06);color:#fff;border-radius:8px;width:44px;height:44px;font-size:1.05rem;cursor:pointer;flex:0 0 auto;line-height:1;";
    closeBtn.addEventListener("click", () => this.closeLeaderboardModal());
    header.appendChild(closeBtn);
    card.appendChild(header);

    const list = document.createElement("div");
    list.style.cssText =
      "overflow-y:auto;flex:1 1 auto;padding:0.25rem 1rem 0.75rem;display:flex;flex-direction:column;gap:0.35rem;min-height:80px;";
    card.appendChild(list);
    this.modalList = list;

    const champion = document.createElement("div");
    champion.style.cssText =
      "margin:0 1rem 1rem;padding-top:0.55rem;border-top:1px solid rgba(255,255,255,0.12);font-size:0.82rem;opacity:0.85;display:none;";
    card.appendChild(champion);
    this.modalChampion = champion;

    wrap.addEventListener("click", (ev) => {
      if (ev.target === wrap) this.closeLeaderboardModal();
    });
    wrap.appendChild(card);
    document.body.appendChild(wrap);
    this.modal = wrap;
    this.renderModalBody();
    window.addEventListener("keydown", this.onModalKeydown);
    this.overlayBack?.push(LEADERBOARD_OVERLAY_ID, () => {
      this.closeLeaderboardModal({ fromHistory: true });
    });
    closeBtn.focus();
  }

  private renderModalBody(): void {
    if (this.modalList) this.fillRankedList(this.modalList);
    if (this.modalChampion) this.fillChampion(this.modalChampion);
  }

  private readonly onModalKeydown = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    this.closeLeaderboardModal();
  };

  closeLeaderboardModal(opts?: { fromHistory?: boolean }): void {
    if (!this.modal) return;
    this.modal.remove();
    this.modal = null;
    this.modalList = null;
    this.modalChampion = null;
    window.removeEventListener("keydown", this.onModalKeydown);
    if (!opts?.fromHistory) this.overlayBack?.dismiss(LEADERBOARD_OVERLAY_ID);
  }

  /** Brief centered celebration banner. */
  flashGoal(scorerName: string | null, country: string | null): void {
    const banner = document.createElement("div");
    const flagImg = country ? createFlagImg(country) : null;
    const who = scorerName ? ` - ${scorerName}` : "";
    banner.appendChild(document.createTextNode("⚽ GOAL!"));
    if (flagImg) {
      banner.appendChild(document.createTextNode(" "));
      banner.appendChild(flagImg);
    }
    if (who) banner.appendChild(document.createTextNode(who));
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

  /**
   * Personal NIM-reward note shown just under the GOAL banner - only to the player who scored.
   * `earned` (green) confirms NIM credited; `capped` (amber) explains why none was paid (daily
   * cap reached / pool spent for today). Local to the scorer; never shown to other players.
   */
  flashReward(kind: "earned" | "capped", text: string): void {
    const note = document.createElement("div");
    note.textContent = text;
    const color = kind === "earned" ? "#8ef0b6" : "#ffd27a";
    note.style.cssText =
      `position:fixed;top:25%;left:50%;z-index:121;background:rgba(16,18,22,0.92);color:${color};border:1px solid rgba(255,255,255,0.16);border-radius:10px;padding:0.35rem 0.85rem;font-size:0.85rem;font-weight:700;letter-spacing:0.01em;box-shadow:0 12px 36px rgba(0,0,0,0.45);pointer-events:none;transition:opacity 0.5s ease, transform 0.5s ease;opacity:0;font-family:inherit;white-space:nowrap;`;
    note.style.transform = "translate(-50%, 8px)";
    document.body.appendChild(note);
    requestAnimationFrame(() => {
      note.style.opacity = "1";
      note.style.transform = "translate(-50%, 0)";
    });
    setTimeout(() => {
      note.style.opacity = "0";
      note.style.transform = "translate(-50%, -8px)";
      setTimeout(() => note.remove(), 550);
    }, 2600);
  }

  destroy(): void {
    this.media?.removeEventListener("change", this.onMediaChange);
    window.removeEventListener("resize", this.onMediaChange);
    this.closeLeaderboardModal();
    this.root.remove();
  }
}
