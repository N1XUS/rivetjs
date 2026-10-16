let loads = 0;
// Counts loader runs: invalidate() reruns it.
export const load = () => ({ loads: ++loads });
