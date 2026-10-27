// Vitest `globalSetup` of the `cdk-components` project: one story-app production build per run. Test files run in
// separate forks (isolation), so the harness's per-process build ran once per file; it now skips its build when the
// provided dist is the one it would build (`STORIES_DIST` unchanged). Suites that switch `STORIES_DIST` still build.
// The build runs in child processes (`buildAppInChild`): built in this (the Vitest main) process, rolldown's native heap
// and the module graph stayed resident for the whole run (~1.3 GB under every file's fork + Chromium, UI-RSS 2026-10-28).
import type { TestProject } from "vitest/node";
import { buildAppInChild, dist } from "./app/serve.ts";

declare module "vitest" {
  export interface ProvidedContext {
    /** The story-app dist built by this setup (absolute path). */
    cdkStoriesDist?: string;
  }
}

export default async function setup(project: TestProject): Promise<void> {
  // The main Vitest process has NODE_ENV=test; the build children drop it (a Vite build under it is not a production build).
  await buildAppInChild();
  project.provide("cdkStoriesDist", dist);
}
