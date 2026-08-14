/** Pure helpers for Social + Play Space achievement eligibility. */

function compactWallet(v: string): string {
  return String(v || "")
    .replace(/\s+/g, "")
    .trim()
    .toUpperCase();
}

export function isBetweenUsEligibleWhisper(opts: {
  senderAddress: string;
  targetAddress: string;
}): boolean {
  const sender = compactWallet(opts.senderAddress);
  const target = compactWallet(opts.targetAddress);
  if (!sender || !target) return false;
  if (sender.startsWith("GUEST:") || target.startsWith("GUEST:")) return false;
  if (sender === target) return false;
  return true;
}

export function isTakeALookEligibleProfileView(opts: {
  viewerAddress: string;
  profileAddress: string;
}): boolean {
  const viewer = compactWallet(opts.viewerAddress);
  const profile = compactWallet(opts.profileAddress);
  if (!viewer || !profile) return false;
  if (viewer.startsWith("GUEST:")) return false;
  if (viewer === profile) return false;
  return true;
}

export function isComeOnInHostEligible(opts: {
  hostWallet: string;
  guestAddress: string;
  guestAlreadyJoinedLobby: boolean;
}): boolean {
  if (opts.guestAlreadyJoinedLobby) return false;
  const host = compactWallet(opts.hostWallet);
  const guest = compactWallet(opts.guestAddress);
  if (!host || !guest) return false;
  if (!guest.startsWith("GUEST:")) return false;
  if (host === guest) return false;
  return true;
}
