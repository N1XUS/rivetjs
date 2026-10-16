// Build-time switches defined in vite.config.ts.
interface ImportMetaEnv {
  readonly BD_PREFETCH: "" | "off";
  readonly BD_ALL_LOAD: "" | "1";
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
