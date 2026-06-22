/** Dismissible overlay encouraging guests to get a full Nimiq wallet (CONTEXT: Get a Wallet Prompt). */
export function showGetWalletPrompt(opts: {
  onWebWallet: () => void;
}): void {
  const existing = document.getElementById("nspaceGetWalletPrompt");
  existing?.remove();

  const wrap = document.createElement("div");
  wrap.id = "nspaceGetWalletPrompt";
  wrap.className = "get-wallet-prompt";
  wrap.setAttribute("role", "dialog");
  wrap.setAttribute("aria-modal", "true");
  wrap.setAttribute("aria-labelledby", "nspaceGetWalletTitle");
  wrap.innerHTML = `
    <div class="get-wallet-prompt__card">
      <button type="button" class="get-wallet-prompt__close" aria-label="Close">✕</button>
      <h2 id="nspaceGetWalletTitle" class="get-wallet-prompt__title">Get a Nimiq wallet</h2>
      <p class="get-wallet-prompt__hint">
        Play as a guest today — or sign in with a wallet to explore all of Nimiq Space.
      </p>
      <div class="get-wallet-prompt__actions">
        <button type="button" class="get-wallet-prompt__web">Sign in with wallet</button>
      </div>
      <p class="get-wallet-prompt__pay-label">Or get Nimiq Pay on mobile</p>
      <div class="get-wallet-prompt__stores">
        <a class="get-wallet-prompt__store" href="https://apps.apple.com/app/nimiq-pay/id6479358565" target="_blank" rel="noopener noreferrer">App Store</a>
        <a class="get-wallet-prompt__store" href="https://play.google.com/store/apps/details?id=com.nimiq.pay" target="_blank" rel="noopener noreferrer">Google Play</a>
        <a class="get-wallet-prompt__store" href="https://nimpay.app" target="_blank" rel="noopener noreferrer">nimpay.app</a>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);

  const close = (): void => wrap.remove();

  wrap.querySelector(".get-wallet-prompt__close")!.addEventListener("click", close);
  wrap.addEventListener("click", (e) => {
    if (e.target === wrap) close();
  });
  wrap.querySelector(".get-wallet-prompt__web")!.addEventListener("click", () => {
    close();
    opts.onWebWallet();
  });
}
