---
title: Installation
description: Add @rivetjs/cdk to a Rivet app - one import path per component and module, JSX compiled with your app, optional CSS and Tailwind setup.
template: guide
status: experimental
related: [start/introduction, start/styling, components/overview, foundations/overview]
---

`@rivetjs/cdk` works in any Rivet app (the starters in `templates/`). After this page you can import a component, know which import path holds what, and have Tailwind set up for the state variants.

:::note[Alpha release]
`@rivetjs/cdk` is available on npm as `0.1.0-alpha.1`. Its APIs are experimental. Start with a [Rivet app](site:docs/start/quick-start/), then install the package:

```bash
npm install @rivetjs/cdk
```
:::

## Add the package

```json title="package.json"
{
  "dependencies": {
    "@rivetjs/cdk": "0.1.0-alpha.1",
    "@rivetjs/reactivity": "0.1.0-alpha.1",
    "@rivetjs/runtime": "0.1.0-alpha.1"
  }
}
```

- `@rivetjs/cdk` depends on `@rivetjs/runtime`, `@rivetjs/reactivity` and `@rivetjs/kit` (transitions). List `@rivetjs/reactivity` yourself: your code imports `signal` from it to pass state to components.
- Node.js 24 or later.
- No Vite config: the Rivet Vite plugin (`rivetRouter()` in the starters) compiles the package with your app (see [Source package](#source-package)).

## Import paths

One import path per component and module. Code you do not import is not shipped. There is no root `@rivetjs/cdk` entry.

### Components

`@rivetjs/cdk/<component>` (export `"./*": "./*/index.tsx"`):

| Import | Exports |
| --- | --- |
| `@rivetjs/cdk/button` | `Button` |
| `@rivetjs/cdk/toggle-button` | `ToggleButton` |
| `@rivetjs/cdk/link` | `Link`, `RouterProvider` |
| `@rivetjs/cdk/checkbox`, `@rivetjs/cdk/switch` | `Checkbox`, `CheckboxGroup`, `Switch` |
| `@rivetjs/cdk/radio-group` | `RadioGroup` |
| `@rivetjs/cdk/text-field` | `TextField`, `TextArea` |
| `@rivetjs/cdk/label`, `@rivetjs/cdk/group`, `@rivetjs/cdk/form` | `Label`, `Text`, `FieldError`; `Group`; `Form` |
| `@rivetjs/cdk/listbox` | `ListBox`, `ListBoxItem`, `ListBoxSection`, `ListBoxLoadMoreItem` |
| `@rivetjs/cdk/grid-list`, `@rivetjs/cdk/table`, `@rivetjs/cdk/tree`, `@rivetjs/cdk/navigation-tree`, `@rivetjs/cdk/tag-group` | `GridList`; `Table`; `Tree`; `NavigationTree`; `TagGroup` (and their parts) |
| `@rivetjs/cdk/data` | `createListData`, `createAsyncList`, `createTreeData` |
| `@rivetjs/cdk/select` | `Select` |
| `@rivetjs/cdk/combobox` | `ComboBox` |
| `@rivetjs/cdk/menu` | `MenuTrigger`, `Menu`, `MenuItem`, `MenuSection`, `SubmenuTrigger`, `MenuLoadMoreItem` |
| `@rivetjs/cdk/tabs` | `Tabs` |
| `@rivetjs/cdk/toolbar` | `Toolbar` |
| `@rivetjs/cdk/disclosure` | `DisclosureGroup`, `Disclosure`, `DisclosurePanel`, `DetailsDisclosure` (native `<details>`) |
| `@rivetjs/cdk/accordion` | the disclosure parts plus Angular CDK accordion extras (`openAll`, `closeAll`) |
| `@rivetjs/cdk/breadcrumbs` | `Breadcrumbs` |
| `@rivetjs/cdk/dialog`, `@rivetjs/cdk/modal` | `DialogTrigger`, `Dialog`; `Modal`, `ModalOverlay` |
| `@rivetjs/cdk/popover`, `@rivetjs/cdk/overlay-arrow` | `Popover`; `OverlayArrow` |
| `@rivetjs/cdk/tooltip`, `@rivetjs/cdk/preview-trigger` | `TooltipTrigger`, `Tooltip`; `PreviewTrigger` |
| `@rivetjs/cdk/date-field`, `@rivetjs/cdk/date-picker` | `DateField`; `DatePicker`, `DateRangePicker` |
| `@rivetjs/cdk/calendar`, `@rivetjs/cdk/range-calendar` | `Calendar`; `RangeCalendar` |
| `@rivetjs/cdk/virtualizer` | `Virtualizer` and its layouts (React Spectrum) |
| `@rivetjs/cdk/scrolling` | `VirtualScrollViewport` and scroll strategies (Angular CDK) |

Exact exports and props: each [component page](../components/overview.md).

### Behaviour for your own markup

`@rivetjs/cdk/<component>/behaviour` holds the attribute builders and event handlers a component uses, as plain functions, for widgets with your own markup (for example `menuTriggerProps`, `menuEvent` from `@rivetjs/cdk/menu/behaviour`). Available for button, toggle-button, checkbox, text-field, label, form, listbox, select, combobox, menu, tabs, toolbar, radio-group, dialog, modal, popover, tooltip, calendar, date-field, date-picker, scrolling and virtualizer.

### State and collections

| Import | Gives you |
| --- | --- |
| `@rivetjs/cdk/state/*` | React Stately state as signals: `list`, `selection`, `select`, `combobox`, `menu`, `tabs`, `toggle`, `overlays`, `tooltip`, `radio-group`, `checkbox-group`, `disclosure`, `calendar`, `date-field`, `date-picker`, `form-validation`, `toast` |
| `@rivetjs/cdk/collections` | Selection state as a signal, DOM collections |
| `@rivetjs/cdk/collections/*` | `builder` (`Item`, `Section`), `list`, `tree`, `grid`, `table`, `list-state`, `tree-state`, `dom`, `selection-model`, `data-source`, `unique-selection-dispatcher` |
| `@rivetjs/cdk/selection/*` | React Aria selection: `manager`, `state`, `selectable-list`, `selectable-item`, `selectable-collection`, `list-keyboard-delegate`, `type-select` |

### Interactions and accessibility

| Import | Gives you |
| --- | --- |
| `@rivetjs/cdk/interactions/*` | React Aria interactions: `press`, `hover`, `focus`, `focus-visible`, `keyboard`, `long-press`, `move`, `interact-outside`, `scroll-wheel`, `merge-props`, `utils` |
| `@rivetjs/cdk/interactions` | `controllable()` (prop merging: `mergeProps` from `@rivetjs/cdk/utils`) |
| `@rivetjs/cdk/a11y` | `announce()`, focusable / tabbable checks, visually hidden styles |
| `@rivetjs/cdk/a11y/*` | Angular CDK a11y: `focus-monitor`, `focus-trap`, `key-manager`, `live-announcer`, `interactivity-checker`, `high-contrast`, `aria-describer` |
| `@rivetjs/cdk/announcer`, `@rivetjs/cdk/live-announcer` | `<Announcer />` live regions; React Aria live announcer |
| `@rivetjs/cdk/focus`, `@rivetjs/cdk/focus-scope`, `@rivetjs/cdk/focus-ring` | Focus management, `<FocusScope>`, focus ring state |
| `@rivetjs/cdk/keys` | Key managers and typeahead |
| `@rivetjs/cdk/dom-props` | `GlobalDOMAttributes`, `globalDOMProps()` |

### Overlays and positioning

- React Aria: `overlay`, `position`, `overlay-trigger`, `overlay-trigger-state`, `modal-overlay`, `prevent-scroll`, `aria-hide-outside`, `close-on-scroll`, `dismiss-button`, `overlay-strings`, `portal`, `modal/provider`, `popover/use-popover`.
- Angular CDK: `overlay-service`, `overlay-ref`, `overlay-container`, `overlay-position-builder`, `connected-position`, `global-position`, `scroll-strategies`, `overlay-dispatchers`, `overlay-strategy`, `overlay-viewport`, `portal-outlet`, `portal-mount`.

All as `@rivetjs/cdk/<name>`. Guide: [Overlays](../foundations/overlays.md).

### Other modules

`id`, `platform`, `bidi`, `bidi-dir`, `clipboard`, `coercion`, `layout`, `observers`, `utils`, `dom`, `links`, `i18n`, `i18n-provider`, `date` (@internationalized/date), `text-field/autosize`. Guides: [CDK](../foundations/overview.md).

### CSS files

None is required. Components need no stylesheet.

| Import | Contents |
| --- | --- |
| `@rivetjs/cdk/theme.css` | Optional starter look for the default `rv-*` classes (layer `rivet.theme`). See [Styling](styling.md#theme-css). |
| `@rivetjs/cdk/tailwind.css` | Tailwind v4 custom variants: `focused`, `placement-*`, `orientation-*`, `entering`, `exiting`. |
| `@rivetjs/cdk/overlay.css` | Structural styles of the Angular-style overlays (`createOverlayRef`, `.cdk-overlay-*`). Only when you use `@rivetjs/cdk/overlay-ref` and friends. |
| `@rivetjs/cdk/text-field.css` | Textarea autosize and autofill monitoring (`@rivetjs/cdk/text-field/autosize`). |
| `@rivetjs/cdk/scrolling.css` | Virtual scroll viewport (`@rivetjs/cdk/scrolling`). |

## Source package

`@rivetjs/cdk` ships JavaScript, JSX and TypeScript declarations. Its `package.json` has `"rivet": { "source": true }`: the Rivet Vite plugin compiles its JavaScript / JSX modules like your own code, in resume mode, with stable module ids (`@rivetjs/cdk/<path>`).

- Callbacks and slot props you pass to cdk components can be any function, the same as for your own components: the component that passes them runs again in the browser on the first event.
- cdk component code joins your app's chunks (by default the chunk of each route that uses it; code several routes use goes into shared chunks) and loads only when needed.
- `"sideEffects": ["*.css"]`: only the CSS files have side effects; unused modules are dropped.

## Tailwind v4

Declare the layer order first, so the optional theme sits below Tailwind's utilities and your classes win:

```css title="src/styles.css"
@layer theme, base, rivet, components, utilities;
@import "tailwindcss";
@import "@rivetjs/cdk/tailwind.css";
/* Optional starter look: */
@import "@rivetjs/cdk/theme.css";
@source "./**/*.{ts,tsx}";
```

- `@source` scans your own files. Classes you pass to cdk components live in your files, so nothing in `node_modules` needs scanning.
- Without Tailwind, import nothing, or only `@rivetjs/cdk/theme.css`.

Next: [Styling](styling.md).
