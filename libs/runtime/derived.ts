// Derived model (M2 lane R, plan docs/design/plans/2026-10-18-derived-client.md, spec
// docs/design/specs/2026-10-18-structural-resume-design.md §3.5): the build-time switch of the adopt runtime's hook in
// `_for` (`dom-v2.ts`). `false` here; resumed browser builds get
// `export const DERIVED = true;` in its place (`libs/compiler/switches.ts` `DERIVED_SWITCHES`, served together with the
// lazy rows switches: the derived adopt run needs the `_adoption.node` / `slot` hooks those enable). Every use is
// `DERIVED && …`: the bundler folds the constant, so other builds carry none of it (0 bytes). Imported by relative path
// (browser test harnesses serve this file too; a derived test serves the `true` module).
export const DERIVED = false as boolean;
