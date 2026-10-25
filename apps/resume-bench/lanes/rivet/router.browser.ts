import { createRouter } from "@rivetjs/runtime/router/dom";

/** Use the served browser URL and origin, under Root's live reactive owner. */
export function createBenchRouter(_initialUrl: string) {
  return createRouter();
}
