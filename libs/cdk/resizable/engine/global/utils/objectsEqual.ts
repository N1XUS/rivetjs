// Ported from react-resizable-panels (lib/global/utils/objectsEqual.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
export function objectsEqual(a: object, b: object) {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }

  for (const key in a) {
    if (a[key as keyof typeof a] !== b[key as keyof typeof b]) {
      return false;
    }
  }

  return true;
}
