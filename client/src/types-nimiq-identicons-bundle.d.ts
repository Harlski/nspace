declare module "@nimiq/identicons/dist/identicons.bundle.min.js" {
  const Identicons: {
    toDataUrl(address: string): Promise<string>;
    svg(address: string): Promise<string>;
    _svgTemplate(
      main: string,
      background: string,
      face: string,
      top: string,
      side: string,
      bottom: string,
      accent: string
    ): Promise<string>;
    _btoa(s: string): string;
  };
  export const IdenticonsAssets: string;
  export function makeHash(input: string): string;
  export function hashToIndices(
    main: number,
    background: number,
    accent: number
  ): { main: number; background: number; accent: number };
  export default Identicons;
}
