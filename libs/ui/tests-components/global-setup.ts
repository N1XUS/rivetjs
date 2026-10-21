// Vitest `globalSetup` of the `ui-components` project: one story-app production build per run. Test files run in
// separate forks (isolation), so the harness's per-process build ran once per file; it now skips its build when the
// provided dist is the one it would build (`STORIES_DIST` unchanged). Suites that switch `STORIES_DIST` still build.
import type { TestProject } from "vitest/node";
import { buildApp, dist } from "./app/serve.ts";

declare module "vitest" {
  export interface ProvidedContext {
    /** The story-app dist built by this setup (absolute path). */
    uiStoriesDist?: string;
  }
}

export default async function setup(project: TestProject): Promise<void> {
  // The main Vitest process has NODE_ENV=test (workers drop it in libs/testing/node-env.ts); a Vite build under it is
  // not a production build (different chunks, resume errors on the pages), so build as the harness did in a worker.
  const nodeEnv = process.env.NODE_ENV;
  if (nodeEnv === "test") delete process.env.NODE_ENV;
  try {
    await buildApp();
  } finally {
    if (nodeEnv !== undefined) process.env.NODE_ENV = nodeEnv;
  }
  project.provide("uiStoriesDist", dist);
}
