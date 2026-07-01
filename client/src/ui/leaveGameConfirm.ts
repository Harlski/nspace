/** Nimiq Pay: confirm before hardware back exits the mini-app. */
export function showLeaveGameConfirm(): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "external-visit-confirm";
    overlay.setAttribute("aria-hidden", "false");
    overlay.innerHTML = `
      <div class="external-visit-confirm__backdrop" aria-hidden="true"></div>
      <div class="external-visit-confirm__dialog" role="dialog" aria-modal="true" aria-labelledby="leave-game-title">
        <h2 id="leave-game-title" class="external-visit-confirm__title">Leave Nimiq Space?</h2>
        <p class="external-visit-confirm__lead">You'll return to Nimiq Pay. You can open Nimiq Space again anytime from Discover.</p>
        <p class="external-visit-confirm__disclaimer"><em>Your session will disconnect from the current room.</em></p>
        <div class="external-visit-confirm__actions">
          <button type="button" class="external-visit-confirm__btn external-visit-confirm__btn--cancel">Stay</button>
          <button type="button" class="external-visit-confirm__btn external-visit-confirm__btn--confirm">Leave</button>
        </div>
      </div>
    `;

    const finish = (leave: boolean): void => {
      overlay.remove();
      resolve(leave);
    };

    const backdrop = overlay.querySelector(
      ".external-visit-confirm__backdrop"
    ) as HTMLElement;
    const stayBtn = overlay.querySelector(
      ".external-visit-confirm__btn--cancel"
    ) as HTMLButtonElement;
    const leaveBtn = overlay.querySelector(
      ".external-visit-confirm__btn--confirm"
    ) as HTMLButtonElement;

    backdrop.addEventListener("click", () => finish(false));
    stayBtn.addEventListener("click", () => finish(false));
    leaveBtn.addEventListener("click", () => finish(true));

    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    };
    window.addEventListener("keydown", onKeyDown, { once: true });

    document.body.appendChild(overlay);
    stayBtn.focus({ preventScroll: true });
  });
}
