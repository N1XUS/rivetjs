export interface PreviewExecutorSchema {
  /** Port (`PORT` for the project's `serve.js` / the router's Node server, `--port` for `vite preview`). */
  port?: number;
  /** Host (`HOST` / `--host`). */
  host?: string;
  /** Build output folder, relative to the project. Default `dist`. */
  outputPath?: string;
  /** Extra environment variables. */
  env?: Record<string, string>;
}
