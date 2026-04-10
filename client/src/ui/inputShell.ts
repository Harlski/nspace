/**
 * Best-effort game shell: reduce accidental browser back/forward, backspace navigation,
 * middle-click autoscroll, and context menu on the game surface.
 */
export function installInputShell(gameSurface: HTMLElement): () => void {
  const historyTrap = (): void => {
    try {
      history.pushState({ nspace: 1 }, "", location.href);
    } catch {
      /* ignore */
    }
  };
  historyTrap();

  const onPopState = (e: PopStateEvent): void => {
    if ((e.state as { nspace?: number } | null)?.nspace !== 1) {
      historyTrap();
    }
  };
  window.addEventListener("popstate", onPopState);

  const editable = (el: EventTarget | null): boolean => {
    if (!el || !(el instanceof HTMLElement)) return false;
    const tag = el.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (el.isContentEditable) return true;
    return Boolean(el.closest("input, textarea, select, [contenteditable=true]"));
  };

  const onKeyDown = (e: KeyboardEvent): void => {
    if (editable(e.target)) return;
    if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      return;
    }
    if (e.altKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
    }
  };

  const onAuxClick = (e: MouseEvent): void => {
    if (e.button === 3 || e.button === 4) e.preventDefault();
  };

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button === 1) e.preventDefault();
  };

  const onContextMenu = (e: MouseEvent): void => {
    if (gameSurface.contains(e.target as Node)) e.preventDefault();
  };

  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("auxclick", onAuxClick, true);
  window.addEventListener("pointerdown", onPointerDown, true);
  gameSurface.addEventListener("contextmenu", onContextMenu);

  return () => {
    window.removeEventListener("popstate", onPopState);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("auxclick", onAuxClick, true);
    window.removeEventListener("pointerdown", onPointerDown, true);
    gameSurface.removeEventListener("contextmenu", onContextMenu);
  };
}
