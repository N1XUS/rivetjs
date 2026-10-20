import { load } from "@rivetjs/router";
let loads = 0;
// Counts loader runs: invalidate() reruns it.
export const loader = load(() => ({ loads: ++loads }));
