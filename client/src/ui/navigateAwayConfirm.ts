export type NavigateAwayConfirmKind = "external" | "miniapp";

export type NavigateAwayConfirmRequest = {
  kind: NavigateAwayConfirmKind;
  url: string;
  /** Shown in mini-app copy (e.g. project name). */
  displayName?: string;
  onConfirm: () => void;
};

export function navigateAwayConfirmCopy(
  kind: NavigateAwayConfirmKind,
  displayName?: string
): { title: string; lead: string; disclaimer: string } {
  if (kind === "miniapp") {
    const name = String(displayName ?? "").trim() || "this mini-app";
    return {
      title: "Open mini-app?",
      lead: `You are about to leave Nimiq Space to open ${name}. When you return here, you can continue where you left off.`,
      disclaimer:
        "Nimiq Space does not control third-party mini-apps. Use the back button or mini-app switcher in Nimiq Pay to return.",
    };
  }
  return {
    title: "Open external website?",
    lead: "You are about to leave Nimiq Space and open a link in a new tab.",
    disclaimer:
      "Nimiq Space does not control the content or safety of external sites.",
  };
}
