# @rivetjs/cdk/disclosure
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

RAC Disclosure port: `DisclosureGroup`, `Disclosure`, `DisclosurePanel` (+ `<Button slot="trigger">`), react-aria useDisclosure, react-stately disclosure state — plus the Angular CDK accordion extras on the same parts (user decision 2026-10-06; `@rivetjs/cdk/accordion` re-exports this module). `DetailsDisclosure` = native `<details>` (zero JS).

## Entry points
- `@rivetjs/cdk/disclosure` → `index.tsx`: `DisclosureGroup`, `Disclosure`, `DisclosurePanel`, `DetailsDisclosure`; contexts `DisclosureGroupStateContext`, `DisclosureContext`, `DisclosureStateContext`; `createDisclosureGroupState`, `createDisclosureState`, `allowsMultiple`, `openAll`, `closeAll`; types
- `@rivetjs/cdk/disclosure/behaviour` → `behaviour.tsx` (explicit entry): `disclosureProps(props, state)`, `disclosureButtonPress` / `PressStart`, `disclosurePanelBeforeMatch`, `disclosurePanelStyle`, `disclosurePanelHidden`, `disclosureTriggerId` / `disclosurePanelId`
- `@rivetjs/cdk/state/disclosure` → `../state/disclosure.ts`: `createDisclosureState`, `setExpanded`, `expand`, `collapse`, `toggleDisclosure`, `createDisclosureGroupState`, `allowsMultiple`, `setExpandedKeys`, `isKeyExpanded`, `keyExpanded`, `toggleKey`, `registerDisclosure` / `unregisterDisclosure`, `openAll` / `closeAll`

## Layout
- `index.tsx` — RAC parts; `details.tsx` — `DetailsDisclosure` (`details.rv-DetailsDisclosure` > `summary.rv-DetailsDisclosure-summary` + `div.rv-DetailsDisclosure-panel`; `group` = native `name`)
- `behaviour.tsx` — useDisclosure (panel `hidden` binding runs the layout effect only on a change)
- Tests: `tests/disclosure-state.test.ts` (react-stately ports), `tests/disclosure-behaviour.test.ts` (useDisclosure port), `tests/accordion.test.ts` (Angular accordion.spec on the group state), `tests/resume.test.ts` "accordion" (story `tests/app/src/routes/accordion.tsx`); DetailsDisclosure: `tests-components/widgets.test.ts` / `dom-events-forms.test.ts` (routes `forms.tsx`, `dom-events-forms.tsx`); resumed panel animation: `tests-components/disclosure.test.ts` (route `disclosure.tsx`)
- Docs examples: `apps/cdk-docs/examples/disclosure-*/`, `accordion-*/`

## Upstream
- RAC `Disclosure.tsx`; react-aria `disclosure/useDisclosure.ts`; react-stately `disclosure/{useDisclosureState,useDisclosureGroupState}.ts` (Apache-2.0); Angular CDK `accordion/{accordion,accordion-item}.ts` (MIT) for the extras

## Rules / invariants
- `isExpanded` / `expandedKeys` / `allowsMultipleExpanded`: plain value (controlled) or Signal (two-way); single-expansion clamp at creation + every write (+ clientEffect when `allowsMultipleExpanded` is an accessor)
- `render` prop (RAC DOMRenderProps; `(attrs, renderProps)` → spread attrs; early return before the compiled element; `tests/render-collections.browser.test.tsx`) on DisclosureGroup / Disclosure / DisclosurePanel (panel `beforematch` = `onBeforeMatch` key)
- Inside a group, `isExpanded` = `expandedKeys.has(id)`; Disclosure registers with its disabled flag, unregisters on cleanup when it has an owner (client-rendered)
- `openAll` only with multiple expansion; `openAll` / `closeAll` skip disabled members
- `onOpened` / `onClosed` on expanded changes; `onDestroyed` on client unmount
- Root renders `id` (String(props.id)); ids `<id>-trigger`, `<id>-panel`
- Group keys compare as strings (DOM ids are strings)
- DisclosurePanel attribute order: `hidden` before `style` (JSX + render attrs). The panel is one spread binding, so `hidden` (`disclosurePanelHidden`) writes the size variables first and the `style` accessor keeps the panel's current CSSOM `--disclosure-panel-*` values (server `disclosurePanelStyle` only before the element exists). Before (2026-10-08) the re-applied server style clobbered the px sizes: a resumed panel never animated on its first change
- Live props (P5): `Disclosure` body untracked; `liveOptions(props, ["isDisabled"], ["isExpanded"])` — a live `isDisabled` is an accessor (`disclosureDisabled` returned arrow, `|| group.isDisabled`): press handlers (`behaviour.tsx` reads it at press time), trigger `isDisabled`, `data-disabled` follow it; render-prop `isDisabled` (typed `boolean`) and `registerDisclosure` take the value at creation (ruling); class / style / children from a live view. DisclosureGroup (LIVE-SWEEP round 2): `liveOptions(props, GROUP_LIVE = [isDisabled, allowsMultipleExpanded])` — the state keeps `isDisabled` (creation value) + `liveDisabled`, read with `isGroupDisabled(state)` (group `data-disabled`, member `disclosureDisabled` — a member takes the accessor path when the group's is live); a live `allowsMultipleExpanded` is an accessor like the Signal form (`allowsMultiple`, clamp client effect: a task later). Read once: `id`, `defaultExpanded` / `defaultExpandedKeys`, handlers, `registerDisclosure`'s disabled flag (`openAll` / `closeAll`). Tests `tests/live-props.browser.test.tsx`, `tests-components/live-props.test.ts`

## Commands
- `npx vitest run --project cdk libs/cdk/tests/disclosure-state.test.ts libs/cdk/tests/disclosure-behaviour.test.ts libs/cdk/tests/accordion.test.ts libs/cdk/tests/resume.test.ts`

## Gotchas
- Server writes boolean `hidden=""` (runtime), not `hidden="until-found"`, until the first change — open question for runtime lane; tests select `[hidden]`
- `Button` renders `slot="trigger"` as a DOM attribute (button lane)
- Event order: events fire in disclosure render order (`One opened, One closed, Two opened`), not Angular's dispatcher order
- No `render` prop; not ported: RAC `Disclosure.test.js` / SSR browser tests

## See also
- [../CLAUDE.md](../CLAUDE.md), [../accordion/CLAUDE.md](../accordion/CLAUDE.md), [../button/CLAUDE.md](../button/CLAUDE.md)
- Docs: `apps/cdk-docs/content/components/disclosure.md`, `accordion.md`
