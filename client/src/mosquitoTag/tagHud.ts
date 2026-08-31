import { t } from "@nspace/i18n";
import type { MosquitoTagWire } from "../net/ws.js";
import { identiconDataUrl } from "../game/identiconTexture.js";
import { listHasTagAddress, sameTagAddress } from "./ids.js";
import { tagHudResultView, tagHudStungCaption } from "./tagHudResult.js";

/**
 * Participant HUD for Mosquito Tag: Tag Countdown with rules, round timer,
 * Stung identicon / last-remaining result, and screen flash when the Mosquito
 * lands on you or when you Pass it.
 * Bystanders do not see the timer overlay.
 */
export class MosquitoTagHud {
  private readonly stack: HTMLDivElement;
  private readonly root: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly countEl: HTMLDivElement;
  private readonly stungRow: HTMLDivElement;
  private readonly identiconEl: HTMLImageElement;
  private readonly stungCaptionEl: HTMLDivElement;
  private readonly rulesEl: HTMLDivElement;
  private readonly flashEl: HTMLDivElement;
  private readonly holderPopup: HTMLDivElement;
  private timer: number | null = null;
  private snap: MosquitoTagWire | null = null;
  private recvAt = 0;
  private selfAddress = "";
  private displayNameFor: ((address: string) => string) | null = null;
  private holderPopupUntil = 0;
  private flashClear: number | null = null;
  private popupClear: number | null = null;
  private identiconFor = "";

  constructor() {
    const stack = document.createElement("div");
    stack.className = "hud-tag-stack";
    stack.hidden = true;
    const root = document.createElement("div");
    root.className = "hud-tag-timer";
    const title = document.createElement("div");
    title.className = "hud-tag-timer__title";
    const count = document.createElement("div");
    count.className = "hud-tag-timer__count";
    const stungRow = document.createElement("div");
    stungRow.className = "hud-tag-timer__stung";
    stungRow.hidden = true;
    const ident = document.createElement("img");
    ident.className = "hud-tag-timer__identicon";
    ident.alt = t("mosquitoTag.stungIdenticonAlt");
    const caption = document.createElement("div");
    caption.className = "hud-tag-timer__stung-caption";
    stungRow.append(ident, caption);
    const rules = document.createElement("div");
    rules.className = "hud-tag-timer__rules";
    root.append(title, count, stungRow, rules);

    const popup = document.createElement("div");
    popup.className = "hud-tag-holder-popup";
    popup.hidden = true;
    popup.setAttribute("role", "status");
    stack.append(popup, root);

    const host =
      document.querySelector(".hud") ??
      document.querySelector(".letterbox") ??
      document.body;
    host.appendChild(stack);
    this.stack = stack;
    this.root = root;
    this.titleEl = title;
    this.countEl = count;
    this.stungRow = stungRow;
    this.identiconEl = ident;
    this.stungCaptionEl = caption;
    this.rulesEl = rules;
    this.holderPopup = popup;

    const flash = document.createElement("div");
    flash.className = "hud-tag-holder-flash";
    flash.hidden = true;
    document.body.appendChild(flash);
    this.flashEl = flash;
  }

  sync(
    snap: MosquitoTagWire | null,
    selfAddress: string,
    displayNameFor?: (address: string) => string
  ): void {
    this.snap = snap;
    this.selfAddress = selfAddress;
    this.displayNameFor = displayNameFor ?? null;
    this.recvAt = performance.now();
    this.render();
    if (this.shouldShow() && this.timer == null) {
      this.timer = window.setInterval(() => this.render(), 200);
    }
  }

  /** Screen flash + copy when this client becomes the Holder. */
  announceYouAreHolder(): void {
    this.playFlash("obtain");
    this.holderPopup.textContent = t("mosquitoTag.holderPopup");
    this.holderPopup.hidden = false;
    this.syncStackVisibility();
    this.holderPopupUntil = performance.now() + 3_200;
    if (this.popupClear != null) window.clearTimeout(this.popupClear);
    this.popupClear = window.setTimeout(() => {
      this.holderPopup.hidden = true;
      this.popupClear = null;
      this.syncStackVisibility();
    }, 3_200);
  }

  /** Green flash when this client Passes the Mosquito. */
  announceYouPassed(): void {
    this.playFlash("pass");
  }

  hide(): void {
    this.root.style.display = "none";
    this.hideIdenticon();
    if (this.timer != null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.syncStackVisibility();
  }

  private playFlash(kind: "obtain" | "pass"): void {
    this.flashEl.hidden = false;
    this.flashEl.classList.toggle("hud-tag-holder-flash--good", kind === "pass");
    this.flashEl.classList.remove("hud-tag-holder-flash--active");
    void this.flashEl.offsetWidth;
    this.flashEl.classList.add("hud-tag-holder-flash--active");
    if (this.flashClear != null) window.clearTimeout(this.flashClear);
    this.flashClear = window.setTimeout(() => {
      this.flashEl.classList.remove("hud-tag-holder-flash--active");
      this.flashEl.classList.remove("hud-tag-holder-flash--good");
      this.flashEl.hidden = true;
      this.flashClear = null;
    }, 700);
  }

  private hideIdenticon(): void {
    this.stungRow.hidden = true;
    this.stungCaptionEl.textContent = "";
    this.identiconEl.removeAttribute("src");
    this.identiconFor = "";
  }

  private showStungIdenticon(playerId: string): void {
    const name = this.displayNameFor?.(playerId)?.trim() || playerId;
    const caption = tagHudStungCaption(name);
    this.stungCaptionEl.textContent = caption;
    this.identiconEl.alt = caption;
    this.stungRow.hidden = false;
    if (this.identiconFor === playerId && this.identiconEl.getAttribute("src")) {
      return;
    }
    this.identiconFor = playerId;
    void identiconDataUrl(playerId).then((url) => {
      if (this.identiconFor !== playerId) return;
      if (url) this.identiconEl.src = url;
    });
  }

  private syncStackVisibility(): void {
    const timerOn = this.root.style.display === "flex";
    const popupOn = !this.holderPopup.hidden;
    this.stack.hidden = !timerOn && !popupOn;
  }

  private shouldShow(): boolean {
    const snap = this.snap;
    if (!snap || snap.phase === "idle" || snap.phase === "calling") return false;
    const self = this.selfAddress;
    return (
      listHasTagAddress(snap.participants, self) ||
      (snap.caller != null && sameTagAddress(snap.caller, self)) ||
      listHasTagAddress(snap.joiners, self)
    );
  }

  private remainingMs(stored: number): number {
    return Math.max(0, stored - (performance.now() - this.recvAt));
  }

  private render(): void {
    if (this.holderPopupUntil > 0 && performance.now() >= this.holderPopupUntil) {
      this.holderPopup.hidden = true;
    }
    if (!this.shouldShow() || !this.snap) {
      this.hide();
      return;
    }
    const snap = this.snap;
    this.root.style.display = "flex";
    this.syncStackVisibility();
    if (snap.phase === "countdown") {
      this.hideIdenticon();
      this.titleEl.textContent = t("mosquitoTag.countdownTitle");
      const n = Math.max(1, Math.ceil(this.remainingMs(snap.countdownRemainingMs) / 1000));
      this.countEl.hidden = false;
      this.countEl.textContent = String(n);
      this.rulesEl.textContent = t("mosquitoTag.countdownRules");
      this.rulesEl.hidden = false;
      return;
    }
    this.rulesEl.hidden = true;
    this.rulesEl.textContent = "";
    if (snap.phase === "playing") {
      this.hideIdenticon();
      const holding =
        snap.holder != null && sameTagAddress(snap.holder, this.selfAddress);
      this.titleEl.textContent = holding
        ? t("mosquitoTag.roundTitleHolder")
        : t("mosquitoTag.roundTitleRunner");
      const s = Math.max(0, Math.ceil(this.remainingMs(snap.roundRemainingMs) / 1000));
      this.countEl.hidden = false;
      this.countEl.textContent = `${s}s`;
      return;
    }
    this.titleEl.textContent = t("mosquitoTag.resultTitle");
    const result = tagHudResultView(snap.outcome);
    if (result.kind === "stung_identicon") {
      this.countEl.hidden = true;
      this.countEl.textContent = "";
      this.showStungIdenticon(result.playerId);
    } else if (result.kind === "last_remaining") {
      this.hideIdenticon();
      this.countEl.hidden = false;
      this.countEl.textContent = t("mosquitoTag.lastRemaining");
    } else {
      this.hideIdenticon();
      this.countEl.hidden = false;
      this.countEl.textContent = "";
    }
  }
}
