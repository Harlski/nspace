import { sameTagAddress } from "./ids.js";

export type TagScreenFlash = "obtain" | "pass" | null;

/** Red obtain flash vs green Pass flash for the local player. */
export function tagScreenFlash(opts: {
  prevHolder: string | null;
  nextHolder: string | null;
  selfAddress: string;
  prevPlaying: boolean;
  nextPlaying: boolean;
}): TagScreenFlash {
  if (!opts.selfAddress) return null;
  const wasSelf =
    opts.prevHolder != null && sameTagAddress(opts.prevHolder, opts.selfAddress);
  const isSelf =
    opts.nextHolder != null && sameTagAddress(opts.nextHolder, opts.selfAddress);
  if (opts.nextPlaying && isSelf && !wasSelf) return "obtain";
  if (opts.prevPlaying && opts.nextPlaying && wasSelf && !isSelf) return "pass";
  return null;
}
