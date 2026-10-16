// Production build (default resolution of the cdk `#dev` import, package.json): dev-only code folds away
// (`if (DEV && …)`), so neither the warnings nor `devWhere` ship.
export const DEV: boolean = false;

/** Development-only (`dev-on.ts`); "" here. */
export function devWhere(): string {
  return "";
}
