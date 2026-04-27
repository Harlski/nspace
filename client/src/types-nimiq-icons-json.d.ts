declare module "nimiq-icons/icons.json" {
  const value: {
    prefix: string;
    icons: Record<
      string,
      { body: string; width?: number; height?: number; hidden?: boolean }
    >;
  };
  export default value;
}
