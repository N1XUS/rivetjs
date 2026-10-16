// Ported from react-resizable-panels (lib/global/cursor/supportsAdvancedCursorStyles.ts, v4.14.3), MIT, © Brian Vaughn.
// Rivet: engine file kept as upstream (framework-free); `.ts` import specifiers.
let cached: boolean | undefined = undefined;

export function overrideSupportsAdvancedCursorStylesForTesting(override: boolean) {
  cached = override;
}

/**
 * Caches and returns if advanced cursor CSS styles are supported.
 */
export function supportsAdvancedCursorStyles(): boolean {
  if (cached === undefined) {
    cached = false;

    if (typeof window !== "undefined") {
      if (window.navigator.userAgent.includes("Chrome") || window.navigator.userAgent.includes("Firefox")) {
        cached = true;
      }
    }
  }

  return cached;
}
