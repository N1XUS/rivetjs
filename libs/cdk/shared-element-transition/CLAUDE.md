# @rivetjs/cdk/shared-element-transition
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC `SharedElementTransition` / `SharedElement`: elements that animate between parents. A scope holds snapshots by name; the next visible instance of a name animates from the previous one's rect + computed `transition-property` values.

## Entry points
- `@rivetjs/cdk/shared-element-transition` -> `index.tsx`: `SharedElement`, `SharedElementProps`, `SharedElementPropsBase`, `SharedElementRenderProps`; re-exports `SharedElementTransition`, `SharedElementTransitionProps`, `SharedElementContext`, `SharedElementScope`, `Snapshot`

## Layout
- `transition.tsx` - scope half: `SharedElementContext` (value `{}` plain object) + `SharedElementTransition` (Provider). Imported by tabs / radio-group, so their chunks never carry the SharedElement code
- `index.tsx` - `SharedElement` (effect + per-scope microtask scheduler)
- tests: `../tests/shared-element.browser.test.tsx` (project `cdk-browser`), `../tests-components/selection-indicator.test.ts` (resumed story `/selection-indicator`, `/selection-indicator-groups`)

## Upstream
- RAC `SharedElementTransition.tsx` (2025, Apache-2.0). No upstream test suite exists
- Rivet deviations: render props are accessors (`isEntering()`, `isExiting()`); `class` / `style` / `children` may be functions of them; no `render` prop, no forwarded `ref`; `isVisible` = boolean or accessor

## Rules / invariants
- Behaviour per change of `isVisible` (RAC layout effect): cleanup = snapshot when the element was rendered (connected, no `data-exiting`, `transition-property` != `none`: rect + computed values); visible + snapshot → previous values inline (`translate` = rect delta), cancel animations those writes started, restore next frame; visible, no snapshot → `data-entering="true"` one frame; hidden → after consumers ran, unconsumed snapshot → `data-exiting="true"` until `getAnimations()` finish, then unmounted; consumed → unmounted. Unmount also snapshots
- Ordering: per scope ONE microtask runs phase 0 (snapshots) → 1 (consumers) → 2 (exit checks), so effect order between instances never matters (React: all cleanups before all setups). Tasks of a superseded effect run are dropped (`run` counter)
- Resume: no JS before the first change; state starts from `isVisible`. Show keyed per instance (never adopts the server element)
- Server: no effect, no `data-entering` / `data-exiting`; client detection `typeof requestAnimationFrame === "function"` (compiler rejects `window` / `document` reads in component code)
- Throws `<SharedElement> must be rendered inside a <SharedElementTransition>` without a scope

## Commands
- `npx vitest run --project cdk-browser libs/cdk/tests/shared-element.browser.test.tsx`
- `STORIES_DIST=dist-indicator npx vitest run --project cdk-components libs/cdk/tests-components/selection-indicator.test.ts`

## Gotchas
- `<SharedElement>` must be the content of its own region site on a resumed page (e.g. a component element in a slot rendered inside the item): reads evaluated in a `const` before JSX attribute to the enclosing For region, whose re-creation adopts rows and never re-renders the element (see tabs `content()`)
- `ref` element binding records a `data-r` on the server-rendered element (ref capture)

## See also
- [../selection-indicator/CLAUDE.md](../selection-indicator/CLAUDE.md), [../tabs/CLAUDE.md](../tabs/CLAUDE.md), [../CLAUDE.md](../CLAUDE.md)
- `apps/cdk-docs/content/components/tabs.md` ("Animated selection indicator")
