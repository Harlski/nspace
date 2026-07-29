import {
  createProfileClient,
  type ProfileClient,
} from "@nimconnect/profile-client";

const NIMCONNECT_APP_URL = "https://nimconnect.nimiqminiapps.com";
const NIMCONNECT_HANDLE_RE = /^[a-z0-9_]{3,31}$/;

type NimConnectHandleReader = Pick<ProfileClient, "getHandleByAddress">;

export type NimConnectProfileIdentity = {
  element: HTMLAnchorElement;
  show: (address: string, isSelf: boolean) => Promise<void>;
  reset: () => void;
};

function clearIdentityElement(element: HTMLAnchorElement): void {
  element.hidden = true;
  element.textContent = "";
  element.removeAttribute("href");
  element.removeAttribute("aria-label");
}

export function createNimConnectProfileIdentity(
  reader: NimConnectHandleReader = createProfileClient()
): NimConnectProfileIdentity {
  const element = document.createElement("a");
  element.className = "other-player-profile__nimconnect-handle";
  clearIdentityElement(element);

  let requestId = 0;

  function reset(): void {
    requestId += 1;
    clearIdentityElement(element);
  }

  async function show(address: string, isSelf: boolean): Promise<void> {
    const currentRequestId = ++requestId;
    clearIdentityElement(element);

    const normalizedAddress = String(address ?? "").trim();
    if (!normalizedAddress) return;

    try {
      const claim = await reader.getHandleByAddress(normalizedAddress);
      if (currentRequestId !== requestId) return;

      const handle = String(claim?.handle ?? "").trim();
      if (handle && NIMCONNECT_HANDLE_RE.test(handle)) {
        element.textContent = `@${handle}`;
        element.href = `${NIMCONNECT_APP_URL}/u/${encodeURIComponent(handle)}`;
        element.setAttribute("aria-label", `Open @${handle} in NimConnect`);
        element.hidden = false;
        return;
      }

      if (!claim && isSelf) {
        element.textContent = "Claim an @handle";
        element.href = `${NIMCONNECT_APP_URL}/`;
        element.setAttribute("aria-label", "Claim an @handle in NimConnect");
        element.hidden = false;
      }
    } catch {
      if (currentRequestId === requestId) clearIdentityElement(element);
    }
  }

  return { element, show, reset };
}
