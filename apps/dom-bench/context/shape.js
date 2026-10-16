// Shared scenario shape for the context suite (both lanes, DOM + server). Depth 500: both lanes overflow the
// stack somewhere around 600-1100 nested reactive levels cold (see the run's "max-depth" row), so 1000 is not portable.
export const CONTEXTS = 50,
  LEAVES = 1000,
  READS = 10,
  TREE = 9;
export const scenarios = ["deep-100", "deep-500", "providers-50", "tree-1023", "update-1000", "error-500", "themed-500"];
