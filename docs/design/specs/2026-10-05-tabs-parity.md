# Tabs — 1:1 parity with react-aria / react-stately / RAC (2026-10-05, re-port 2026-10-08)

Sources: react-stately `tabs/useTabListState.ts`, `list/useSingleSelectListState.ts`; react-aria `tabs/{useTabList,useTab,useTabPanel,TabsKeyboardDelegate,utils}.ts`, `selection/*`; RAC `Tabs.tsx`. Tests: RAC `test/Tabs.test.js` → `libs/cdk/tests/tabs.browser.test.tsx` (42 cases), story suites `libs/cdk/tests-components/tabs*.test.ts`.

2026-10-08 (coordinator decision, user cdk rule 2026-10-05): RAC parts ported 1:1 (`Tabs` / `TabList` / `Tab` / `TabPanels` / `TabPanel`, render props, `data-*`, `render`, contexts, SelectionIndicator); the data-driven `items` API is a thin preset over the same parts (no second code path); all non-RAC names / deprecated aliases removed.

## Parity

| Original | Rivet | Status | Tests |
| --- | --- | --- | --- |
| `useTabListState` default key = first non-disabled, all disabled → first | `createTabListState({ tabs })` / `findDefaultSelectedKey`; parts: one build pass over the children | done (at creation; no `onSelectionChange`) | tabs-state; tabs.browser "should select the first non-disabled tab" |
| controlled / uncontrolled `selectedKey` / `defaultSelectedKey` / `onSelectionChange` (fires on re-select) | `selectedKey`: Signal (two-way) or plain value (controlled cell) | done | tabs-state "plain controlled"; tabs.browser controlled cases |
| "always a selected tab" effect when the selected item disappears | at creation only | partial | tabs-state |
| focus follows selection while not focused | `effectiveFocusedKey` + `focusedSelection` | done | tabs-state; tabs "automatic" |
| `isDisabled`, `disabledKeys`, `Tab isDisabled` | same | done | tabs.browser disabled cases |
| `orientation`, `keyboardActivation` | same | done | tabs.browser; tabs "manual" |
| TabsKeyboardDelegate | `tabs/keyboard-delegate.ts` (direction from the DOM) | done | tabs.browser RTL (`dir="rtl"` element) |
| useTab press (usePress: press events, `data-pressed`, mouse down / key down select, link tabs on press up / click) | per-tab `pressProps` + `tabPressStart` / `tabPressUp` / `tabPress` / `tabClick` | done | tabs.browser "press events", "links" |
| hover / focus / focus-visible states, render props | `../utils/data-attrs.tsx` handlers + signals when render props ask | done | tabs.browser "render props", tabs "parts" |
| FocusableContext (TooltipTrigger on a Tab) | `mergeFocusableContext` | done | tabs.browser "supports tooltips" |
| ids `<id>-tab-<key>` / `<id>-tabpanel-<key>`, tablist `<id>-tablist` | same, from the Tabs `id` | deviation (RAC `useId` per state) | tabs "renders" |
| `aria-controls` only on the selected tab; panel role / id / labels only while selected | same | done | tabs "renders" |
| TabPanel `shouldForceMount`, inactive `inert` + `data-inert` | same | done | tabs.browser "shouldForceMount" |
| TabPanel enter / exit (`data-entering` / `data-exiting`) | `createEnterAnimation` / `createExitAnimation` | done (browser-created panels) | tabs.browser |
| TabPanels `--tab-panel-width/height` | browser clientEffect on selection change | done (browser-created; previous size approximated) | tabs.browser "block-size / inline-size" |
| TabPanel `tabIndex=0` only without tabbable children (useHasTabbableChild) | `syncPanelTabIndex` | partial (server renders 0) | tabs "number keys" |
| SelectionIndicator / SharedElementTransition | TabList scope + Tab `SelectionIndicatorContext` | done | shared-element.browser, selection-indicator |
| `render` prop (DOMRenderProps) on every part | same | done | tabs.browser, cdk-docs `tabs-custom` |
| nested tabs | panels clear `TabsContext` / `TabListStateContext` | done (RAC re-provides nothing either way) | tabs.browser "nested" |
| Activity (React 19) | — | not ported | — |

## Deviations (with reasons)
- `items` preset on `Tabs` (Rivet): `TabList items` + force-mounted `TabPanels items` (`hidden` + `inert`): every panel in the server HTML (find-in-page, SEO, no fetch on switch).
- Default selection at state creation (server); no `onSelectionChange` for it.
- Unselected panels' children must be render functions (created in the browser on a resumed page).
