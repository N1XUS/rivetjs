// Build hook: how the app loads the shell cache (`routeRules` `shell`, `shell-cache.ts`). The router's Vite plugin
// (`build/vite.ts`) rewrites `SHELL_BUILD` to an `import()` of `shell-cache.ts` (by file path) in the bundles of apps whose
// `rivetRouter({ routeRules })` has a `shell` rule; everywhere else no module imports `shell-cache.ts`, so other apps'
// server output has no shell chunk at all (zero bytes; a guarded `import()` would still emit the chunk). Shell rules given
// at run time only (`createApp` / `start({ routeRules })`) need the build to name one too.
import type * as ShellCache from "./shell-cache.ts";

/** Loads the shell cache module, or undefined when this bundle has none (rewritten by `build/vite.ts`). */
export const SHELL_BUILD = undefined as (() => Promise<typeof ShellCache>) | undefined;
