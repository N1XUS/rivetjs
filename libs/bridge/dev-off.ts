// Production build (default resolution of the bridge `#dev` import, package.json): dev-only code folds away
// (`if (DEV && …)`), so neither the checks nor `devWhere` ship.
export const DEV: boolean = false;

/** Development-only (`dev-on.ts`); "" here. */
export function devWhere(): string {
  return "";
}
