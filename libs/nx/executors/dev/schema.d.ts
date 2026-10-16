export interface DevExecutorSchema {
  /** Port (`--port`); Vite's default 5173. */
  port?: number;
  /** Host to listen on (`--host`); `true` = all addresses. */
  host?: string | boolean;
  /** Fail when the port is taken instead of trying the next one. */
  strictPort?: boolean;
  /** Open the browser. */
  open?: boolean;
  /** Vite config file, relative to the project. */
  config?: string;
  /** Vite mode. */
  mode?: string;
  /** Extra environment variables. */
  env?: Record<string, string>;
}
