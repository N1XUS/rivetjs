import { load } from "@rivetjs/router";
let loads = 0;
// Counts loader runs: hash-only navigation must not rerun it.
export const loader = load(() => ({ load: ++loads }));
