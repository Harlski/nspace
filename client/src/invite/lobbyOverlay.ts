export type DirectInviteLobbyState = {
  slug: string;
  phase: string;
  hostDisplayName: string;
  shareUrl: string;
  expiresAtMs: number;
  isHost: boolean;
  roster: { displayName: string }[];
  occupancy: number;
  capacity: number;
};

export type DirectInviteLobbyHandlers = {
  onCancel?: () => void;
  onCopyUrl?: (url: string) => void;
  /** Dismiss the share panel (it can be re-opened from the persistent HUD button). */
  onClose?: () => void;
};

/** Extract the short room code from a share URL (the `/join/{slug}` tail), or fall back. */
function roomCodeFromShareUrl(shareUrl: string, slug: string): string {
  const m = shareUrl.match(/\/join\/([^/?#]+)/);
  return m?.[1] ?? slug;
}

export function createDirectInviteLobbyOverlay(
  hostEl: HTMLElement,
  handlers: DirectInviteLobbyHandlers
): {
  show: (state: DirectInviteLobbyState) => void;
  hide: () => void;
  isOpen: () => boolean;
  showError: (message: string) => void;
} {
  const overlay = document.createElement("div");
  overlay.className = "direct-invite-lobby";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="direct-invite-lobby__panel">
      <button type="button" class="direct-invite-lobby__close" aria-label="Close">✕</button>
      <h2 class="direct-invite-lobby__title"></h2>
      <p class="direct-invite-lobby__status"></p>
      <div class="direct-invite-lobby__code">
        <span class="direct-invite-lobby__code-label">Room code</span>
        <button type="button" class="direct-invite-lobby__code-value" title="Copy room code"></button>
      </div>
      <ul class="direct-invite-lobby__roster"></ul>
      <div class="direct-invite-lobby__share">
        <input class="direct-invite-lobby__url" readonly />
        <button type="button" class="direct-invite-lobby__copy">Copy link</button>
      </div>
      <div class="direct-invite-lobby__qr"></div>
      <div class="direct-invite-lobby__actions">
        <button type="button" class="direct-invite-lobby__cancel">Leave</button>
      </div>
      <p class="direct-invite-lobby__error" hidden></p>
    </div>
  `;
  hostEl.appendChild(overlay);

  const titleEl = overlay.querySelector<HTMLElement>(".direct-invite-lobby__title")!;
  const statusEl = overlay.querySelector<HTMLElement>(".direct-invite-lobby__status")!;
  const codeEl = overlay.querySelector<HTMLButtonElement>(".direct-invite-lobby__code-value")!;
  const rosterEl = overlay.querySelector<HTMLElement>(".direct-invite-lobby__roster")!;
  const urlEl = overlay.querySelector<HTMLInputElement>(".direct-invite-lobby__url")!;
  const copyBtn = overlay.querySelector<HTMLButtonElement>(".direct-invite-lobby__copy")!;
  const qrHost = overlay.querySelector<HTMLElement>(".direct-invite-lobby__qr")!;
  const cancelBtn = overlay.querySelector<HTMLButtonElement>(".direct-invite-lobby__cancel")!;
  const closeBtn = overlay.querySelector<HTMLButtonElement>(".direct-invite-lobby__close")!;
  const errEl = overlay.querySelector<HTMLElement>(".direct-invite-lobby__error")!;

  let lastShareUrl = "";
  let lastRoomCode = "";
  let renderedQrUrl = "";

  copyBtn.addEventListener("click", () => {
    void navigator.clipboard.writeText(lastShareUrl);
    handlers.onCopyUrl?.(lastShareUrl);
    copyBtn.textContent = "Copied!";
    setTimeout(() => {
      copyBtn.textContent = "Copy link";
    }, 1500);
  });

  codeEl.addEventListener("click", () => {
    if (!lastRoomCode) return;
    void navigator.clipboard.writeText(lastRoomCode);
    const prev = codeEl.textContent;
    codeEl.textContent = "Copied!";
    setTimeout(() => {
      codeEl.textContent = prev;
    }, 1200);
  });

  closeBtn.addEventListener("click", () => handlers.onClose?.());

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

  function renderRoster(state: DirectInviteLobbyState): void {
    rosterEl.replaceChildren();
    const names = state.roster.map((p) => p.displayName);
    for (const name of names) {
      const li = document.createElement("li");
      li.className = "direct-invite-lobby__roster-item";
      li.textContent = name;
      rosterEl.appendChild(li);
    }
  }

  return {
    show(state: DirectInviteLobbyState) {
      overlay.hidden = false;
      errEl.hidden = true;
      titleEl.textContent = "Private play space";
      statusEl.textContent =
        state.occupancy <= 1
          ? "Share the link to invite friends in."
          : `${state.occupancy}/${state.capacity} in the space`;
      renderRoster(state);
      lastShareUrl = state.shareUrl;
      lastRoomCode = roomCodeFromShareUrl(state.shareUrl, state.slug);
      codeEl.textContent = lastRoomCode;
      urlEl.value = state.shareUrl;
      // Any occupant may leave the space (server `cancelDirectInvite`).
      cancelBtn.hidden = false;
      cancelBtn.textContent = "Leave";
      if (state.shareUrl && state.shareUrl !== renderedQrUrl) {
        renderedQrUrl = state.shareUrl;
        void renderQr(state.shareUrl);
      }
    },
    hide() {
      overlay.hidden = true;
    },
    isOpen() {
      return !overlay.hidden;
    },
    showError(message: string) {
      errEl.textContent = message;
      errEl.hidden = false;
      overlay.hidden = false;
    },
  };
}
