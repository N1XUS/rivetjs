// `--import` preload for running suites under `--conditions=development` with a recording devtools
// hook (level 2, stacks on): the façades must stay transparent while everything is reported. Installed
// before any reactivity module evaluates (type-only import), like the devtools agent: debug.ts keeps
// inert bindings observable only when the hook exists at its import.
import type { DevtoolsHook } from "../debug.ts";

const HOOK = Symbol.for("rivet.devtools");

let events = 0;
const hook: DevtoolsHook = {
  v: 1,
  level: 2,
  stacks: true,
  emit(_type, data) {
    // Touch the payload like an agent would, without keeping it.
    if (typeof data !== "object") throw new TypeError("devtools event data must be an object");
    events++;
  },
};
(globalThis as { [HOOK]?: DevtoolsHook })[HOOK] = hook;
// Then debug, as a dev page reaches it through the façades: graph views see every binding.
await import("../debug.ts");
process.on("exit", () => {
  if (process.env.RIVET_DEVTOOLS_EVENTS) console.log(`devtools hook: ${events} events`);
});
