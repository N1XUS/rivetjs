// Labels shared by the API pages (api.ts, server only) and content generation (tools/content/generate.ts, `::api` cards): no node / virtual imports.
import type { RunsOn } from "./tools/app.ts";

/** Human label of a symbol's / entry's `runsOn`. */
export const RUNS_ON: Record<RunsOn, string> = {
  server: "Runs on the server",
  browser: "Runs in the browser",
  both: "Runs on the server and in the browser",
  build: "Used at build time",
};
