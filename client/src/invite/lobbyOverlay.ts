export type DirectInviteLobbyState = {
  slug: string;
  phase: string;
  hostDisplayName: string;
  guestDisplayName: string | null;
  shareUrl: string;
  expiresAtMs: number;
  isHost: boolean;
  canStart: boolean;
};

export type DirectInviteLobbyHandlers = {
  onStartMatch?: () => void;
  onCancel?: () => void;
  onCopyUrl?: (url: string) => void;
};

export function createDirectInviteLobbyOverlay(
  hostEl: HTMLElement,
  handlers: DirectInviteLobbyHandlers
): {
  show: (state: DirectInviteLobbyState) => void;
  hide: () => void;
  showError: (message: string) => void;
} {
  const overlay = document.createElement("div");
  overlay.className = "direct-invite-lobby";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="direct-invite-lobby__panel">
      <h2 class="direct-invite-lobby__title"></h2>
      <p class="direct-invite-lobby__status"></p>
      <div class="direct-invite-lobby__share">
        <input class="direct-invite-lobby__url" readonly />
        <button type="button" class="direct-invite-lobby__copy">Copy link</button>
      </div>
      <div class="direct-invite-lobby__qr"></div>
      <div class="direct-invite-lobby__actions">
        <button type="button" class="direct-invite-lobby__start">Start Match</button>
        <button type="button" class="direct-invite-lobby__cancel">Cancel invite</button>
      </div>
      <p class="direct-invite-lobby__error" hidden></p>
    </div>
  `;
  hostEl.appendChild(overlay);

  const titleEl = overlay.querySelector<HTMLElement>(".direct-invite-lobby__title")!;
  const statusEl = overlay.querySelector<HTMLElement>(".direct-invite-lobby__status")!;
  const urlEl = overlay.querySelector<HTMLInputElement>(".direct-invite-lobby__url")!;
  const copyBtn = overlay.querySelector<HTMLButtonElement>(".direct-invite-lobby__copy")!;
  const qrHost = overlay.querySelector<HTMLElement>(".direct-invite-lobby__qr")!;
  const startBtn = overlay.querySelector<HTMLButtonElement>(".direct-invite-lobby__start")!;
  const cancelBtn = overlay.querySelector<HTMLButtonElement>(".direct-invite-lobby__cancel")!;
  const errEl = overlay.querySelector<HTMLElement>(".direct-invite-lobby__error")!;
  const shareBlock = overlay.querySelector<HTMLElement>(".direct-invite-lobby__share")!;
  const actionsBlock = overlay.querySelector<HTMLElement>(".direct-invite-lobby__actions")!;

  let lastShareUrl = "";

  copyBtn.addEventListener("click", () => {
    void navigator.clipboard.writeText(lastShareUrl);
    handlers.onCopyUrl?.(lastShareUrl);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy link";
    }, 1500);
  });

  startBtn.addEventListener("click", () => handlers.onStartMatch?.());
  cancelBtn.addEventListener("click", () => handlers.onCancel?.());

  async function renderQr(url: string): Promise<void> {
    qrHost.replaceChildren();
    if (!url) return;
    try {
      const { default: QrCreator } = await import("qr-creator");
      QrCreator.render(
        { text: url, radius: 0.4, ecLevel: "M", fill: "#111", background: "#fff", size: 160 },
        qrHost
      );
    } catch {
      /* QR optional */
    }
  }

  function statusLine(state: DirectInviteLobbyState): string {
    if (state.phase === "open") return "Waiting for friend…";
    if (state.phase === "claimed") return "Friend is joining…";
    if (state.guestDisplayName && state.phase === "lobby") {
      return `${state.guestDisplayName} is ready`;
    }
    if (state.phase === "starting") return "Starting match…";
    return "Invite lobby";
  }

  return {
    show(state: DirectInviteLobbyState) {
      overlay.hidden = false;
      errEl.hidden = true;
      titleEl.textContent = state.isHost
        ? "Invite a friend"
        : `${state.hostDisplayName}'s Match`;
      statusEl.textContent = statusLine(state);
      lastShareUrl = state.shareUrl;
      urlEl.value = state.shareUrl;
      shareBlock.hidden = !state.isHost;
      qrHost.hidden = !state.isHost;
      actionsBlock.hidden = false;
      startBtn.hidden = !state.isHost;
      startBtn.disabled = !state.canStart;
      cancelBtn.hidden = !state.isHost;
      cancelBtn.textContent = "Cancel invite";
      if (state.isHost && state.shareUrl !== lastShareUrl) {
        void renderQr(state.shareUrl);
      } else if (state.isHost) {
        void renderQr(state.shareUrl);
      }
    },
    hide() {
      overlay.hidden = true;
    },
    showError(message: string) {
      errEl.textContent = message;
      errEl.hidden = false;
      overlay.hidden = false;
    },
  };
}
