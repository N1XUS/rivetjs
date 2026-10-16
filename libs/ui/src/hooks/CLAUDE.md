# libs/ui/src/hooks

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Ports of HeroUI v3.2.6 `packages/react/src/hooks/*` (Apache-2.0, © 2025 NextUI Inc.). Not a package subpath yet: root barrel export of the hooks is decided in Plan 2 Task 24 (`tests/package.test.ts` pins the name list); `useOverlayState` is exported from the root barrel (`libs/ui/index.ts` "Hooks" section, as upstream `@heroui/react`) because the Modal / AlertDialog / Drawer demos need it.

## Files

| File | Upstream | What |
| --- | --- | --- |
| `use-css-variable.ts` | `hooks/use-css-variable.ts` | `useCSSVariable(name, override?, cache = true): string \| undefined`: `override` if defined; `undefined` without `document` (server); else trimmed computed value on `document.documentElement` (`undefined` when empty or on error), cached per name (incl. cached `undefined`). `_clearCSSVariableCache()` test-only. |
| `use-overlay-state.tsx` | `hooks/use-overlay-state.ts` | `useOverlayState({ isOpen?, defaultOpen?, onOpenChange? })` → `{ isOpen(), setOpen, open, close, toggle }` on the cdk `createOverlayTriggerState` (`isOpen` plain / Signal / accessor). `isOpen` is a read-only accessor: `isOpen={state.isOpen} onOpenChange={(o) => state.setOpen(o)}` = upstream's controlled pair. `.tsx` so the accessor + methods are compiler-registered (resume). |

## Invariants

- Plain functions, not React hooks: no render cycle, no `useIsSSR`/`useMemo`. Server and resumed pages keep the server markup (default variant); a client-created component reads the variable once at creation (a later CSS change is not followed; `cache = false` re-reads on each creation).
- Tests: `../../tests/use-css-variable.test.ts` (override, server undefined, cache, empty).
- `useOverlayState` tests (also used by the `alert-dialog-controlled` / `drawer-controlled` docs demos): `../../tests/modal.test.tsx` (open / toggle / close + `onOpenChange` through `state`), Chromium `../../tests-components/modal.test.ts` (resumed `state` prop).
