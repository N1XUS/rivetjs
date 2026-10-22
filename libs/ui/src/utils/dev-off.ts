// Production build (default resolution of `#dev`, package.json): dev-only code folds away (`if (DEV && …)`).
// `DEV` is `false` here and the dev hooks object in `dev-on.ts`: dev-only helpers are called through it (`DEV.shorthandIgnored(…)`),
// never imported by name. A named import of a dev-only module stays in production output (rolldown includes modules before it
// folds the imported `DEV`; a shared one became a 401 B chunk + preload of ~393 ui-docs example pages, DIET-CONST 2026-10-22).

/** Dev-only helpers (`dev-on.ts`). */
export interface DevHooks {
  /** `utils/shorthand.ts` `warnShorthandIgnored`: `children` and a shorthand prop of `keys` both given (call with `children` set). */
  shorthandIgnored(component: string, props: object, keys: readonly string[]): void;
  /** `utils/shorthand.ts` `warnItemsIgnored`: a picker root got `items` next to compound children. */
  itemsIgnored(component: string): void;
}

export const DEV: DevHooks | false = false;
