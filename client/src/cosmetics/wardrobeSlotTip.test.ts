import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bindWardrobeSlotTooltip,
  createWardrobeSlotTooltip,
  resetWardrobeSlotTipsForTests,
  slotAriaLabel,
} from "./wardrobeSlotTip.js";

describe("wardrobeSlotTip", () => {
  afterEach(() => {
    resetWardrobeSlotTipsForTests();
    document.body.replaceChildren();
  });

  it("builds aria-label from slot label and preset name", () => {
    expect(slotAriaLabel("Nameplate", "Neon Frame")).toBe("Nameplate: Neon Frame");
  });

  it("shows tooltip on hover and hides on leave", () => {
    const host = document.createElement("div");
    host.className = "wardrobe-slot-tip-host";
    const btn = document.createElement("button");
    host.append(btn, createWardrobeSlotTooltip("Aura"));
    document.body.appendChild(host);
    bindWardrobeSlotTooltip(host, btn);

    const tip = host.querySelector(".wardrobe-slot-tip")!;
    btn.dispatchEvent(new MouseEvent("mouseenter"));
    expect(tip.classList.contains("is-visible")).toBe(true);
    btn.dispatchEvent(new MouseEvent("mouseleave"));
    expect(tip.classList.contains("is-visible")).toBe(false);
  });

  it("pins tooltip after long-press until pointerdown elsewhere", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    host.className = "wardrobe-slot-tip-host";
    const btn = document.createElement("button");
    host.append(btn, createWardrobeSlotTooltip("Trail"));
    document.body.appendChild(host);
    bindWardrobeSlotTooltip(host, btn);

    const tip = host.querySelector(".wardrobe-slot-tip")!;
    btn.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 1 }));
    vi.advanceTimersByTime(400);
    btn.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    expect(tip.classList.contains("is-visible")).toBe(true);
    expect(tip.classList.contains("is-pinned")).toBe(true);

    document.body.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 2 }));
    expect(tip.classList.contains("is-visible")).toBe(false);
    vi.useRealTimers();
  });

  it("suppresses click after long-press on editable slots", () => {
    vi.useFakeTimers();
    const host = document.createElement("div");
    host.className = "wardrobe-slot-tip-host";
    const btn = document.createElement("button");
    host.append(btn, createWardrobeSlotTooltip("Chat bubble"));
    document.body.appendChild(host);
    bindWardrobeSlotTooltip(host, btn, { editable: true });

    let clicked = false;
    btn.addEventListener("click", () => {
      clicked = true;
    });

    btn.dispatchEvent(new PointerEvent("pointerdown", { button: 0, pointerId: 1 }));
    vi.advanceTimersByTime(400);
    btn.dispatchEvent(new PointerEvent("pointerup", { pointerId: 1 }));
    btn.click();
    expect(clicked).toBe(false);
    vi.useRealTimers();
  });
});
