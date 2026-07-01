/** History entry pushed by {@link createOverlayBackStack}. */
export type NspaceHistoryState =
  | { nspace: { trap: true } }
  | { nspace: { overlay: string } };

/** Return `true` when the overlay handled back without closing (history will be re-pushed). */
export type OverlayPopHandler = () => boolean | void;

export type OverlayBackStackOptions = {
  /**
   * When the overlay stack is empty and the user presses back.
   * Return `true` to allow leaving (do not re-trap history).
   */
  onEmptyBack?: () => boolean | Promise<boolean>;
};

export type OverlayBackStack = {
  push(id: string, onPop: OverlayPopHandler): void;
  /** User closed the overlay via UI - sync browser history without running `onPop`. */
  dismiss(id: string): void;
  isOpen(id: string): boolean;
  install(): () => void;
};

function pushHistoryState(state: NspaceHistoryState): void {
  try {
    history.pushState(state, "", location.href);
  } catch {
    /* ignore */
  }
}

function isNspaceOverlayState(
  state: unknown,
  id?: string
): state is { nspace: { overlay: string } } {
  if (!state || typeof state !== "object") return false;
  const overlay = (state as NspaceHistoryState).nspace;
  if (!overlay || typeof overlay !== "object" || !("overlay" in overlay)) return false;
  const overlayId = (overlay as { overlay: string }).overlay;
  return typeof overlayId === "string" && (id === undefined || overlayId === id);
}

export function createOverlayBackStack(
  opts?: OverlayBackStackOptions
): OverlayBackStack {
  const stack: Array<{ id: string; onPop: OverlayPopHandler }> = [];
  let historySync = false;
  let installed = false;
  let onPopState: ((e: PopStateEvent) => void) | null = null;

  const trapBase = (): void => {
    pushHistoryState({ nspace: { trap: true } });
  };

  const push = (id: string, onPop: OverlayPopHandler): void => {
    if (stack.some((entry) => entry.id === id)) return;
    pushHistoryState({ nspace: { overlay: id } });
    stack.push({ id, onPop });
  };

  const dismiss = (id: string): void => {
    const idx = stack.findIndex((entry) => entry.id === id);
    if (idx < 0) return;
    stack.splice(idx, 1);
    historySync = true;
    try {
      history.back();
    } catch {
      /* ignore */
    }
  };

  const isOpen = (id: string): boolean => stack.some((entry) => entry.id === id);

  const handlePopState = async (): Promise<void> => {
    if (historySync) {
      historySync = false;
      return;
    }

    const entry = stack[stack.length - 1];
    if (entry) {
      const handled = entry.onPop();
      if (handled === true) {
        pushHistoryState({ nspace: { overlay: entry.id } });
        return;
      }
      stack.pop();
      return;
    }

    const allowExit = await opts?.onEmptyBack?.();
    if (allowExit === true) return;
    trapBase();
  };

  const install = (): (() => void) => {
    if (installed) return () => {};
    installed = true;
    trapBase();
    onPopState = () => {
      void handlePopState();
    };
    window.addEventListener("popstate", onPopState);
    return () => {
      if (onPopState) {
        window.removeEventListener("popstate", onPopState);
        onPopState = null;
      }
      stack.length = 0;
      installed = false;
    };
  };

  return { push, dismiss, isOpen, install };
}

export { isNspaceOverlayState };
