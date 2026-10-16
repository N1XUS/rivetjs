# @rivetjs/cdk parity tracker

Single package `@rivetjs/cdk` = 1:1 ports of react-aria + react-stately + react-aria-components + Angular CDK.

## Rules

- Port upstream source 1:1: behaviour, options, events, edge cases. Adapt only plumbing (React hooks → signals, DI/NgZone/RxJS → plain fns / `Emitter`).
- Shared names (dialog, listbox, menu, tree, table): one `@rivetjs/cdk/<name>` module = union of both upstreams; both upstream suites ported against it.
- Port upstream test suites with the code; tests use `@rivetjs/testing`.
- Per file: license header. Per module: NOTICE entry.
- Docs: own site `apps/cdk-docs` (shared engine extracted from apps/docs). Page per component mirrors upstream doc page (anatomy, props/options, examples, a11y/keyboard, testing via `@rivetjs/testing/user`); merged modules show both APIs.
- Zero-cost per subpath (`scripts/zero-cost/check.sh`), SSR markup + resume.

## Order

0. Fold aria → cdk (done in working tree; commit after gates).
1. `@rivetjs/testing` (dev-only): `/dom`, `/jest`, `/events`, `/resume`, `/browser`, `/testers`. Deps: `@testing-library/dom`, `@testing-library/user-event`. Move `libs/cdk/tests*/` helpers in; re-export `@rivetjs/runtime/testing`.
1b. Docs site (approved 2026-10-05):
   - `libs/docs-kit` (`@rivetjs/docs-kit`, private): content pipeline, build/prerender, examples, api, search, checks, serve, DocPage/Example/CodeBlock/ApiCard/Search/ThemeToggle, base layout + tokens. Tools take `DocsSite` config (root, site, nav, templatesDir?, apiEntries, ports); `docsSite(config)` Vite plugin; generated data via `virtual:docs/*`; resume via `sourcePackages`.
   - Gate: apps/docs output byte-identical (828 pages, search index), docs tests green.
   - `apps/cdk-docs` (ports 4323/4324): takes `content/ui/{accessible,cdk}` + `aria-*`/`cdk-*` examples; nav like upstream (Components, Interactions, Collections/Selection, Overlays, Focus/A11y, Drag & drop, Scrolling/Virtualizer, Dates, Utilities, Testing); typedoc over `@rivetjs/cdk/*`.
   - Page template mirrors upstream: intro, anatomy, example, props/options, features (selection, keyboard, a11y), Testing (`@rivetjs/testing/user` tester); merged modules = two API tabs (react-aria / Angular CDK); `status` frontmatter.
   - apps/docs keeps "Components (cdk)" overview + link; `@rivetjs/testing` docs in main docs (Guides → Testing).
   - Then: every port ships its cdk-docs page.
2. Dedupe `libs/cdk/_adapters/*` onto cdk modules (selection, collections, interactions, overlay/position, i18n).
2b. Overlay layer (approved 2026-10-05): one div overlay (react-aria Overlay/useOverlay + Angular OverlayContainer/OverlayRef); Modal/ModalOverlay/Drawer(Sheet)/Popover/Menu/Select/ComboBox/Tooltip on it; remove native <dialog>, popover attr, invoker commands, ::backdrop. `@rivetjs/kit` `<Transition>` (class props + data attrs) used by every overlay. Port RAC Modal/Popover/Dialog/Menu/Select tests + Angular overlay.spec.
2c. Review fixes (docs/design/specs/2026-10-05-cdk-review.md): H1 overlay teardown on unmount; H2 one Router/openLink; M1 Dir clientEffect; M2 virtualizer/scroll dispose; M3 render-time browser reads (locale, dir, activeElement); M4/M5 dedupe trackers/utils (with step 2); M6 programmatic open; M7 capture handlers; M8 fidelity; Low list; NOTICE/header gaps.
2d. Menu / Disclosure / Accordion (lane C3, user decision 2026-10-06): RAC `MenuTrigger`/`Menu`/`MenuItem`/`MenuSection`/`SubmenuTrigger`/`MenuLoadMoreItem` and `DisclosureGroup`/`Disclosure`/`DisclosurePanel` (+ `Button slot="trigger"`) as parts. Accordion merged into Disclosure: Angular CDK extras (`multi` = `allowsMultipleExpanded` Signal, `openAll`/`closeAll`, `onOpened`/`onClosed`/`onDestroyed`, disabled members kept) live on the same parts/state (`state/disclosure.ts`); `@rivetjs/cdk/accordion` re-exports disclosure + extras; old `Accordion`/`AccordionItem`/`createAccordion` API deleted, no aliases. Native `<details>` kept as `DetailsDisclosure`.
3. Existing failures: overlay browser tests ("DOM portal content must be attached to a parent node"), 8 component-suite timeouts.
4. Component ports (each: upstream hooks + state + RAC component + upstream tests):

| Status | Module | Upstream |
| --- | --- | --- |
| partial | button, toggle-button, checkbox, switch, radio-group, text-field, label, form, group, link, breadcrumbs, toolbar, disclosure/accordion, tabs, dialog, modal, popover, menu, listbox, combobox, calendar, range-calendar, date-field | audit each vs upstream + suite |
| todo | separator, heading/header/text/input/keyboard, field-error | RAC simple |
| todo | meter, progress-bar | @react-aria/meter, progress |
| done | select (+hidden-select) | @react-aria/select, @react-stately/select, RAC Select.tsx (+ HiddenSelect / RAC Select tests) |
| todo | search-field | @react-aria/searchfield |
| todo | number-field (+spinbutton) | @react-aria/numberfield, spinbutton |
| todo | slider | @react-aria/slider |
| todo | toggle-button-group | @react-aria/toggle |
| done | tooltip | @react-aria/tooltip |
| todo | toast | @react-aria/toast |
| todo | autocomplete | @react-aria/autocomplete |
| todo | grid-list | @react-aria/gridlist, grid |
| todo | tag-group | @react-aria/tag |
| todo | table (+Angular CdkTable) | @react-aria/table, cdk/table |
| todo | tree (+Angular CdkTree) | @react-aria/tree, cdk/tree |
| todo | listbox / menu / dialog merge with Angular cdk/listbox, cdk/menu, cdk/dialog | both |
| todo | stepper | cdk/stepper |
| done | date-picker, date-range-picker (+date-field state / segments / HiddenDateInput) | @react-aria/datepicker, @react-stately/datepicker, RAC DatePicker.tsx, DateField.tsx (+ RAC DatePicker / DateRangePicker, useDatePicker tests) |
| todo | color-area/field/picker/slider/swatch/swatch-picker/thumb/wheel | @react-aria/color |
| partial | drag-drop (DragRef, DropListRef, sorting) → directives layer, DragDrop service | cdk/drag-drop |
| todo | dnd: drop-zone, file-trigger, useDragAndDrop, tree drop delegate | @react-aria/dnd |
| todo | virtualizer layouts: grid, table | RAC GridLayout, TableLayout |
| todo | sheet, shared-element-transition, navigation-tree, token-field, preview-trigger, selection-indicator | RAC |
| todo | landmark, visually-hidden, aria-modal-polyfill, live-announcer audit | @react-aria/* |
| todo | keycodes, testing harnesses | cdk/keycodes, cdk/testing |
