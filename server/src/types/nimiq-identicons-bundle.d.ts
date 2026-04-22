declare module "@nimiq/identicons/dist/identicons.bundle.min.js" {
  const Identicons: {
    toDataUrl(address: string): Promise<string>;
  };
  export const IdenticonsAssets: string;
  export default Identicons;
}
