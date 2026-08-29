/** Compact wallet / guest id compare for Mosquito Tag snapshots. */

export function compactTagAddress(address: string): string {
  return address.replace(/\s+/g, "").trim().toUpperCase();
}

export function sameTagAddress(a: string, b: string): boolean {
  const x = compactTagAddress(a);
  const y = compactTagAddress(b);
  return x.length > 0 && x === y;
}

export function listHasTagAddress(list: string[], address: string): boolean {
  return list.some((id) => sameTagAddress(id, address));
}
