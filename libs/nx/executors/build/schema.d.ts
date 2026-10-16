export interface BuildExecutorSchema {
  /** Vite config file, relative to the project (default: Vite's lookup). */
  config?: string;
  /** Vite mode (`--mode`). */
  mode?: string;
  /** Also run the server build (`vite build --ssr`). Default: true, except `rivetRouter({ mode: "csr" })` apps. */
  ssr?: boolean;
  /** Prerender every page after the builds. Default: true for `rivetRouter({ mode: "static" })` apps. */
  prerender?: boolean;
  /** One client build per locale (`RIVET_LOCALE`), for `@rivetjs/i18n` apps. Inferred from `i18n.config.ts`. */
  locales?: string[];
  /** Build output folder, relative to the project (must match the router's `dist`). Default `dist`. */
  outputPath?: string;
  /** Vite `--logLevel`. */
  logLevel?: "info" | "warn" | "error" | "silent";
  /** Extra environment variables for every step. */
  env?: Record<string, string>;
}
