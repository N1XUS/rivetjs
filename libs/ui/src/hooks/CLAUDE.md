# libs/ui/src/hooks

> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Ports of HeroUI v3.2.6 `packages/react/src/hooks/*` (Apache-2.0, © 2025 NextUI Inc.). Not a package subpath: the hooks are root barrel exports (`libs/ui/index.ts` "Hooks" section, as upstream `@heroui/react`; `tests/package.test.ts` pins the name list), each in its own module so an unimported hook costs 0 bytes. All return accessors / plain objects (signals), not React state. PORT-FINAL 2026-10-29 added all but `useOverlayState`; `useCSSVariable` is internal (not a HeroUI root export).

## Files

| File | Upstream | What |
| --- | --- | --- |
| `use-css-variable.ts` | `hooks/use-css-variable.ts` | `useCSSVariable(name, override?, cache = true): string \| undefined`: `override` if defined; `undefined` without `document` (server); else trimmed computed value on `document.documentElement` (`undefined` when empty or on error), cached per name (incl. cached `undefined`). `_clearCSSVariableCache()` test-only. |
| `use-overlay-state.tsx` | `hooks/use-overlay-state.ts` | `useOverlayState({ isOpen?, defaultOpen?, onOpenChange? })` → `{ isOpen(), setOpen, open, close, toggle }` on the cdk `createOverlayTriggerState` (`isOpen` plain / Signal / accessor). `isOpen` is a read-only accessor: `isOpen={state.isOpen} onOpenChange={(o) => state.setOpen(o)}` = upstream's controlled pair. `.tsx` so the accessor + methods are compiler-registered (resume). |
| `use-list-data.ts` | react-stately `useListData` (re-exported by HeroUI) | `useListData` = cdk `createListData` (`@rivetjs/cdk/data`); types `ListData`, `UseListDataOptions`. |
| `use-media-query.tsx` | `useMediaQuery` | `useMediaQuery(query \| () => query, defaultValue = false): () => boolean`; server / first paint = `defaultValue`; a `clientEffect` reads `matchMedia(q).matches` and follows `change` (re-subscribes when an accessor query changes). |
| `use-measured-height.tsx` | `useMeasuredHeight` | `useMeasuredHeight(el \| () => el): () => number` px; `clientEffect` + `ResizeObserver` (`contentRect.height`); `0` unattached / server / no `ResizeObserver`. |
| `use-theme.tsx` + `use-theme-dom.ts` | `useTheme` | DOM / storage helpers live in the `.ts` module (RV2001: browser globals in `.tsx` module code are a build error). `useTheme({ defaultTheme?, storageKey? })` → `{ theme(), resolvedTheme(), setTheme(t) }` (`ThemeChoice` `light \| dark \| system`). `setTheme` writes `light`/`dark` class, `data-theme`, `color-scheme` on `<html>` (+ `localStorage[storageKey]`, try/caught); `system` follows `prefers-color-scheme` live; initial choice = stored > `<html>` marker (unless `defaultTheme` given) > `defaultTheme` > "system". Writes `<html>` only after `setTheme` or a stored choice (never overrides a `ThemeScript` on its own). No cross-tab sync. |
| `use-mounted.tsx` / `use-is-hydrated.tsx` | `useMounted` / `useIsHydrated` | Accessor `false` on the server (and in resumed markup), `true` after the `clientEffect` ran. Ruling 2026-10-29: exported for API parity (no hydration pass, so both mean "client effects ran"); cost 0 unless imported. |
| `use-safe-layout-effect.tsx` | `useSafeLayoutEffect` / `useIsomorphicLayoutEffect` | Both = `clientEffect` (`@rivetjs/runtime/dom`): never on the server, once in the browser, reactive reads re-run, return a cleanup. |

## Invariants

- Plain functions, not React hooks: no render cycle, no `useIsSSR`/`useMemo`. Server and resumed pages keep the server markup (default variant); a client-created component reads the variable once at creation (a later CSS change is not followed; `cache = false` re-reads on each creation).
- Tests: `../../tests/use-css-variable.test.ts` (override, server undefined, cache, empty); `../../tests/hooks-client.test.tsx` (happy-dom: mounted / hydrated, media query + change + unsubscribe, measured height, theme, layout effect, list data) and `../../tests/hooks.server.test.tsx` (SSR defaults, effects never run). Hooks are `.tsx` where they use `clientEffect` (`.ts` modules are not server-rewritten).
- `useOverlayState` tests (also used by the `alert-dialog-controlled` / `drawer-controlled` docs demos): `../../tests/modal.test.tsx` (open / toggle / close + `onOpenChange` through `state`), Chromium `../../tests-components/modal.test.ts` (resumed `state` prop).
