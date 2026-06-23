import { nimiqIconUseMarkup } from "../ui/nimiqIcons.js";
import { resolvePlaySpaceShareUrl } from "./shareUrl.js";

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

const COPY_ICON = nimiqIconUseMarkup("nq-copy", {
  width: 14,
  height: 14,
  class: "direct-invite-lobby__copy-icon",
});

/** Extract the short room code from a share URL (the `/join/{slug}` tail), or fall back. */
function roomCodeFromShareUrl(shareUrl: string, slug: string): string {
  const m = shareUrl.match(/\/join\/([^/?#]+)/);
  return m?.[1] ?? slug;
}

function flashCopyLabel(btn: HTMLButtonElement, label = "Copy"): void {
  const prev = btn.innerHTML;
  btn.textContent = "Copied!";
  setTimeout(() => {
    btn.innerHTML = prev;
  }, 1200);
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
  const panelScaler = document.createElement("div");
  panelScaler.className = "direct-invite-lobby__panel-scaler";
  const panel = document.createElement("div");
  panel.className = "direct-invite-lobby__panel";
  panel.innerHTML = `
      <button type="button" class="direct-invite-lobby__close" aria-label="Close">✕</button>
      <h2 class="direct-invite-lobby__title">Join private play space</h2>
      <p class="direct-invite-lobby__status">Enter the room code or scan the QR code to join.</p>
      <div class="direct-invite-lobby__body">
        <div class="direct-invite-lobby__fields">
          <div class="direct-invite-lobby__field">
            <span class="direct-invite-lobby__field-label">Room code</span>
            <div class="direct-invite-lobby__code-row">
              <span class="direct-invite-lobby__code-value"></span>
              <button type="button" class="direct-invite-lobby__copy-btn direct-invite-lobby__copy-code" aria-label="Copy room code">${COPY_ICON}<span>Copy</span></button>
            </div>
          </div>
          <div class="direct-invite-lobby__field">
            <span class="direct-invite-lobby__field-label">Join link</span>
            <div class="direct-invite-lobby__link-row">
              <input class="direct-invite-lobby__url" readonly aria-label="Join link" />
              <button type="button" class="direct-invite-lobby__copy-btn direct-invite-lobby__copy-link" aria-label="Copy join link">${COPY_ICON}<span>Copy</span></button>
            </div>
          </div>
          <ul class="direct-invite-lobby__roster" hidden></ul>
        </div>
        <div class="direct-invite-lobby__qr-col">
          <p class="direct-invite-lobby__qr-hint">Scan the QR code to join</p>
          <div class="direct-invite-lobby__qr"></div>
        </div>
      </div>
      <div class="direct-invite-lobby__footer">
        <button type="button" class="direct-invite-lobby__dismiss">Close</button>
        <button type="button" class="direct-invite-lobby__leave">Leave play space</button>
      </div>
      <p class="direct-invite-lobby__error" hidden></p>
  `;
  panelScaler.appendChild(panel);
  overlay.appendChild(panelScaler);
  hostEl.appendChild(overlay);

  const statusEl = panel.querySelector<HTMLElement>(".direct-invite-lobby__status")!;
  const codeEl = panel.querySelector<HTMLElement>(".direct-invite-lobby__code-value")!;
  const rosterEl = panel.querySelector<HTMLElement>(".direct-invite-lobby__roster")!;
  const urlEl = panel.querySelector<HTMLInputElement>(".direct-invite-lobby__url")!;
  const copyCodeBtn = panel.querySelector<HTMLButtonElement>(
    ".direct-invite-lobby__copy-code"
  )!;
  const copyLinkBtn = panel.querySelector<HTMLButtonElement>(
    ".direct-invite-lobby__copy-link"
  )!;
  const qrHost = panel.querySelector<HTMLElement>(".direct-invite-lobby__qr")!;
  const leaveBtn = panel.querySelector<HTMLButtonElement>(".direct-invite-lobby__leave")!;
  const dismissBtn = panel.querySelector<HTMLButtonElement>(".direct-invite-lobby__dismiss")!;
  const closeBtn = panel.querySelector<HTMLButtonElement>(".direct-invite-lobby__close")!;
  const errEl = panel.querySelector<HTMLElement>(".direct-invite-lobby__error")!;

  const fitPanelToViewport = (): void => {
    if (overlay.hidden) return;
    panel.style.transform = "";
    panelScaler.style.width = "";
    panelScaler.style.height = "";
    const overlayStyle = getComputedStyle(overlay);
    const padX =
      parseFloat(overlayStyle.paddingLeft) + parseFloat(overlayStyle.paddingRight);
    const padY =
      parseFloat(overlayStyle.paddingTop) + parseFloat(overlayStyle.paddingBottom);
    const availW = Math.max(0, overlay.clientWidth - padX);
    const availH = Math.max(0, overlay.clientHeight - padY);
    const naturalW = panel.offsetWidth;
    const naturalH = panel.offsetHeight;
    if (naturalW <= 0 || naturalH <= 0) return;
    const scale = Math.min(1, availW / naturalW, availH / naturalH);
    if (scale < 1) {
      panel.style.transform = `scale(${scale})`;
      panel.style.transformOrigin = "top left";
      panelScaler.style.width = `${naturalW * scale}px`;
      panelScaler.style.height = `${naturalH * scale}px`;
    } else {
      panelScaler.style.width = `${naturalW}px`;
      panelScaler.style.height = `${naturalH}px`;
    }
  };

  const refitPanel = (): void => {
    requestAnimationFrame(() => {
      fitPanelToViewport();
    });
  };

  const panelFitObserver = new ResizeObserver(() => refitPanel());
  panelFitObserver.observe(overlay);
  panelFitObserver.observe(panel);

  let lastShareUrl = "";
  let lastRoomCode = "";
  let renderedQrUrl = "";

  copyLinkBtn.addEventListener("click", () => {
    void navigator.clipboard.writeText(lastShareUrl);
    handlers.onCopyUrl?.(lastShareUrl);
    flashCopyLabel(copyLinkBtn);
  });

  copyCodeBtn.addEventListener("click", () => {
    if (!lastRoomCode) return;
    void navigator.clipboard.writeText(lastRoomCode);
    flashCopyLabel(copyCodeBtn);
  });

  const dismiss = (): void => handlers.onClose?.();
  closeBtn.addEventListener("click", dismiss);
  dismissBtn.addEventListener("click", dismiss);
  leaveBtn.addEventListener("click", () => handlers.onCancel?.());

  async function renderQr(url: string): Promise<void> {
    qrHost.replaceChildren();
    if (!url) return;
    try {
      const { default: QrCreator } = await import("qr-creator");
      QrCreator.render(
        { text: url, radius: 0.4, ecLevel: "M", fill: "#111", background: "#fff", size: 168 },
        qrHost
      );
      refitPanel();
    } catch {
      /* QR optional */
    }
  }

  function renderRoster(state: DirectInviteLobbyState): void {
    rosterEl.replaceChildren();
    const names = state.roster.map((p) => p.displayName);
    if (names.length === 0) {
      rosterEl.hidden = true;
      return;
    }
    rosterEl.hidden = false;
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
      if (state.occupancy > 1) {
        statusEl.textContent = `${state.occupancy}/${state.capacity} in the space — enter the room code or scan the QR code to join.`;
      } else {
        statusEl.textContent =
          "Enter the room code or scan the QR code to join.";
      }
      renderRoster(state);
      const shareUrl = resolvePlaySpaceShareUrl(state.shareUrl, state.slug);
      lastShareUrl = shareUrl;
      lastRoomCode = roomCodeFromShareUrl(shareUrl, state.slug);
      codeEl.textContent = lastRoomCode;
      urlEl.value = shareUrl;
      leaveBtn.hidden = false;
      if (shareUrl && shareUrl !== renderedQrUrl) {
        renderedQrUrl = shareUrl;
        void renderQr(shareUrl);
      }
      refitPanel();
    },
    hide() {
      overlay.hidden = true;
      panel.style.transform = "";
      panelScaler.style.width = "";
      panelScaler.style.height = "";
    },
    isOpen() {
      return !overlay.hidden;
    },
    showError(message: string) {
      errEl.textContent = message;
      errEl.hidden = false;
      overlay.hidden = false;
      refitPanel();
    },
  };
}
