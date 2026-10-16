let loads = 0;
// Counts loader runs: hash-only navigation must not rerun it.
export const load = () => ({ load: ++loads });
