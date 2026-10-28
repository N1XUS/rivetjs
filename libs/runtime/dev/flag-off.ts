// `@rivetjs/runtime/dev` by default (production). Production builds through the compiler's Vite plugin always resolve
// here, whatever the conditions, so `if (DEV) …` folds away.
/** `true` in development builds, `false` in production: guard dev-only code with `if (DEV)` and production drops it. */
export const DEV: boolean = false;
