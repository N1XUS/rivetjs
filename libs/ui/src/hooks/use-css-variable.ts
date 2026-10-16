// Ported from HeroUI v3.2.6 packages/react/src/hooks/use-css-variable.ts (Apache-2.0, © 2025 NextUI Inc.; modified).
// Rivet: not a React hook (no render cycle, no `useMemo` deps); `useIsSSR()` → `typeof document === "undefined"`. The server
// (and a resumed page, which keeps the server markup) uses the default variant; a client-created component reads the
// variable at creation. `_clearCSSVariableCache` is test-only (tree-shakes).

// Cache for CSS variable values to avoid repeated DOM queries.
const cssVariableCache = new Map<string, string | undefined>();

/**
 * Safely retrieves a CSS custom property from the document element: `override` when defined, `undefined` on the server,
 * otherwise the trimmed computed value (`undefined` when empty), cached per name unless `cache` is false.
 */
export function useCSSVariable(variableName: string, override?: string, cache: boolean = true): string | undefined {
  if (override !== undefined) return override;
  if (typeof document === "undefined") return undefined;
  if (cache && cssVariableCache.has(variableName)) return cssVariableCache.get(variableName);
  try {
    const value = window.getComputedStyle(document.documentElement).getPropertyValue(variableName).trim() || undefined;
    if (cache) cssVariableCache.set(variableName, value);
    return value;
  } catch {
    // Any error (e.g. document not available) → undefined.
    return undefined;
  }
}

/** Test-only: drop the per-name cache. */
export function _clearCSSVariableCache(): void {
  cssVariableCache.clear();
}
