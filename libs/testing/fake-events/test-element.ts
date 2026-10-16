// Ported from Angular Components (src/cdk/testing/test-element.ts, test-element-errors.ts and the
// keycodes the fake events use), MIT, © Google LLC.

/** Modifier keys that may be held while typing. */
export interface ModifierKeys {
  control?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
}

/**
 * Returns an error which reports that no keys have been specified.
 * @docs-private
 */
export function getNoKeysSpecifiedError() {
  return Error('No keys have been specified.');
}

/** `@angular/cdk/keycodes` PERIOD. */
export const PERIOD = 190;
