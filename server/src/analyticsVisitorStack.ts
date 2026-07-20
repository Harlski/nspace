/**
 * Build stacked-bar segments for the analytics unique-visitors chart.
 *
 * Server detail lists (`startUsers` / `endUsers`) are capped (20 per direction),
 * so the listed wallet set can be smaller than `uniqueTotal`. Segment weights must
 * still sum to `uniqueTotal` so bar fill matches the axis / hover count.
 */

export type VisitorStackUser = {
  walletId: string;
  stackW: number;
  ev: number;
  inCount?: number;
  outCount?: number;
  identicon?: string;
};

export type VisitorStackSeg = VisitorStackUser & {
  isOther?: boolean;
};

/**
 * @param uniqueTotal True distinct-wallet count for the slot (from server).
 * @param users Listed wallets available for coloring (may be capped).
 * @param maxNamedSegs Max individually colored wallets before collapse into "other".
 */
export function buildUniqueVisitorBarSegments(
  uniqueTotal: number,
  users: VisitorStackUser[],
  maxNamedSegs: number
): VisitorStackSeg[] {
  const hourTotal = Math.max(0, Math.floor(Number(uniqueTotal) || 0));
  const usersArr = users.filter((u) => (u.stackW || 0) > 0);
  if (hourTotal === 0) return [];

  const segs: VisitorStackSeg[] = [];
  let otherW = 0;
  const namedCap = Math.max(0, Math.floor(Number(maxNamedSegs) || 0));
  usersArr.forEach((u, idx) => {
    if (idx < namedCap) segs.push({ ...u });
    else otherW += Number(u.stackW) || 0;
  });
  // Wallets omitted by the server detail cap still count toward bar height.
  otherW += Math.max(0, hourTotal - usersArr.length);
  if (otherW > 0) {
    segs.push({
      walletId: "",
      identicon: "",
      inCount: 0,
      outCount: 0,
      stackW: otherW,
      ev: 0,
      isOther: true,
    });
  }
  return segs;
}

/** Sum of segment weights (what the chart paints as fill). */
export function visitorStackFillTotal(segs: VisitorStackSeg[]): number {
  return segs.reduce((a, s) => a + (Number(s.stackW) || 0), 0);
}
