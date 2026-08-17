/**
 * Hover and accessible names for the country flag chip on a player profile.
 *
 * Pointer hover uses native `title`. Screen readers use `aria-label`. They match
 * except on the viewer's own chip when a country is already set: hover is the
 * country name; the accessible name also says the chip changes country.
 */

export type ProfileFlagChipKind = "self" | "other";

export function profileFlagChipLabels(
  kind: ProfileFlagChipKind,
  countryName: string | null
): { title: string; ariaLabel: string } | null {
  if (!countryName) {
    if (kind === "self") {
      return {
        title: "Pick your country",
        ariaLabel: "Pick your country",
      };
    }
    return null;
  }
  if (kind === "self") {
    return {
      title: countryName,
      ariaLabel: `${countryName}. Change your country.`,
    };
  }
  return { title: countryName, ariaLabel: countryName };
}
