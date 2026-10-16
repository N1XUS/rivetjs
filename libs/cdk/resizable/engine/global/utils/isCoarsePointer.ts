// Ported from react-resizable-panels (lib/global/utils/isCoarsePointer.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
let cached: boolean | undefined = undefined;

/**
 * Caches and returns matchMedia()'s computed value for "pointer:coarse"
 */
export function isCoarsePointer(): boolean {
  if (cached === undefined) {
    if (typeof matchMedia === "function") {
      cached = !!matchMedia("(pointer:coarse)").matches;
    } else {
      cached = false;
    }
  }

  return cached;
}
