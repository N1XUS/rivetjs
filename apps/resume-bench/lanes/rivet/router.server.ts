import { createRouter } from "@rivetjs/runtime/router/server";

/** Snapshot the request URL without accessing browser state. */
export function createBenchRouter(initialUrl: string) {
  return createRouter(initialUrl);
}
