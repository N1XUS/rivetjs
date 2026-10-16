// Ported from react-resizable-panels (lib/utils/isArrayEqual.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export function isArrayEqual(a: number[], b: number[]) {
  if (a.length !== b.length) {
    return false;
  } else {
    for (let index = 0; index < a.length; index++) {
      if (a[index] != b[index]) {
        return false;
      }
    }
  }
  return true;
}
