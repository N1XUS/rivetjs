// Build-time facts of the derived browser runtime (`dom-derived.ts`, RTSPLIT 2026-11-05): which of its adopt-run features
// the app can reach. `true` here (sources, tests, dev: every feature ships); the compiler plugin serves `false` for a feature
// its production client build proved unused (`libs/compiler/vite.ts` `derivedFeatures`): no resume module names `<For>`
// (`LISTS`: lazy rows, row sampling / writers, list holes), no framework bridges configured (`ISLANDS`: island holes).
// Every use is `LISTS && …` / `if (LISTS)`: the bundler folds the constant, so a build without the feature carries none of
// its code. A hole of a folded kind is never made (only its hook makes it), so every folded test was false anyway.
// `TWO` (COFLAT 2026-11-06): a co-load build (env `RIVET_COLOAD`) that also ships the list-free copy of this runtime (manifest
// `flat`): its groups may let a page evaluate both copies (`dom-derived.ts`: the started one keeps the component ABI). One-pass
// builds never do (the plugin lists `flat` only when no chunk imports a runtime chunk).
// Imported by relative path (no package `imports` entry), like `lazy-rows.ts` / `dom-data.ts`.
export const LISTS = true as boolean;
export const ISLANDS = true as boolean;
export const TWO = true as boolean;
