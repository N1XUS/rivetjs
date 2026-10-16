export interface ApplicationGeneratorSchema {
  /** Project folder, workspace-relative (`apps/web`). */
  directory: string;
  /** Project name (default: the folder name). */
  name?: string;
  /** Starter: `static` (prerendered pages, Tailwind), `server` (loader + action, Node), `ui` (@rivetjs/ui), `minimal`. */
  template?: "static" | "server" | "ui" | "minimal";
  /** `node`: pages render per request (`@rivetjs/router/node`); `static`: prerendered HTML files. Default: from the template. */
  adapter?: "node" | "static";
  /** Platform target (create-rivet `--deploy`): adapter + platform files; `deploy` / `preview` Nx targets. bun / deno: server template. */
  deploy?: "vercel" | "netlify" | "cloudflare" | "bun" | "deno";
  /** Tailwind v4. Default: on, except the minimal starter. */
  tailwind?: boolean;
  /** `vitest`: vitest.config.ts with rivetTest() + a first test. */
  unitTestRunner?: "vitest" | "none";
  /** Comma-separated project tags. */
  tags?: string;
  /** `@rivetjs/*` dependency spec (default: this plugin's version). */
  rivetVersion?: string;
  addPlugin?: boolean;
  skipPackageJson?: boolean;
  skipInstall?: boolean;
  skipFormat?: boolean;
}
