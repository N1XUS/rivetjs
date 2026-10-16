// Ported from HeroUI v3.2.6 packages/react/src/utils/css.ts (Apache-2.0, © 2025 NextUI Inc.).
// Rivet: verbatim.
export const parseCSSTime = (value: string | undefined): number | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  const val = parseFloat(trimmed);

  if (Number.isNaN(val)) return undefined;
  if (trimmed.endsWith("ms")) return val;
  if (trimmed.endsWith("s")) return val * 1000;

  return val;
};
