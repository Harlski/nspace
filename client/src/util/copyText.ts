/** Copy text with Clipboard API, falling back to a hidden textarea. */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  const value = text.trim();
  if (!value) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* try fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = value;
    ta.setAttribute("readonly", "");
    // In-viewport but invisible - some WebViews (Nimiq Pay) reject off-screen execCommand copy.
    ta.style.position = "fixed";
    ta.style.left = "0";
    ta.style.top = "0";
    ta.style.width = "1px";
    ta.style.height = "1px";
    ta.style.opacity = "0";
    ta.style.pointerEvents = "none";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export type CopyControlOptions = {
  onCopied?: () => void;
  stopPropagation?: boolean;
};

/**
 * Wire a button for copy in Nimiq Pay and other touch WebViews: pointerup for touch
 * (click is often skipped) plus clipboard API + textarea fallback.
 */
export function bindCopyToClipboardControl(
  el: HTMLElement,
  getText: () => string,
  opts: CopyControlOptions = {}
): void {
  const stopPropagation = opts.stopPropagation !== false;
  let touchHandled = false;

  const runCopy = (): void => {
    const text = getText().trim();
    if (!text) return;
    void copyTextToClipboard(text).then((ok) => {
      if (ok) opts.onCopied?.();
    });
  };

  const onActivate = (ev: Event): void => {
    if (stopPropagation) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    runCopy();
  };

  el.addEventListener("click", (ev) => {
    if (touchHandled) {
      touchHandled = false;
      ev.preventDefault();
      return;
    }
    onActivate(ev);
  });

  el.addEventListener(
    "pointerup",
    (ev) => {
      if (ev.pointerType !== "touch") return;
      touchHandled = true;
      window.setTimeout(() => {
        touchHandled = false;
      }, 450);
      onActivate(ev);
    },
    { capture: true }
  );
}
