// Shared shape for the component-props suite (both lanes). One row = 6 components (Row, 2×Cell, 2×Label,
// Badge): ROWS × 6 props objects per mount, getter props, one component spread, mergeProps + splitProps.
export const ROWS = 1000,
  SELECTS = 10,
  STRIDE = 10;
export const rowData = (n, revision = 0) => Array.from({ length: n }, (_, i) => ({ id: i, label: `row ${i} r${revision}`, count: i }));
