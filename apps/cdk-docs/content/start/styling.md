---
title: Styling
description: Style headless @rivetjs/cdk components with Tailwind or plain CSS - default rv-* classes, ARIA and data-* state, theme tokens and overlay transitions.
template: guide
status: experimental
related: [start/installation, start/introduction, components/overview, foundations/overlays]
---

cdk components ship no styles. Every part has a class name you can replace, and every state is an attribute on the element: an ARIA attribute (`aria-selected`, `aria-pressed`, `aria-expanded`, `aria-disabled`, `aria-invalid`) or a React Aria Components render-state attribute (`data-pressed`, `data-focused`, `data-entering`, …). Style those with Tailwind variants or CSS attribute selectors.

::example{id=styling-tailwind}

## Class names

Without a class prop, each part gets a default class: `rv-` plus the React Aria Components name (`rv-Button` for RAC `react-aria-Button`). Passing a class prop **replaces** the default; it does not add to it.

Components ported part by part from React Aria Components take a `class` on each part; the default is `rv-` plus the part name. A few components still take one class prop per inner part.

| Component | Parts → default class |
| --- | --- |
| Button, ToggleButton, ToggleButtonGroup, Link, Toolbar, Group | `rv-Button`, `rv-ToggleButton`, `rv-ToggleButtonGroup`, `rv-Link`, `rv-Toolbar`, `rv-Group` |
| ListBox | `ListBox` → `rv-ListBox`, `ListBoxItem` → `rv-ListBoxItem`, `ListBoxSection` → `rv-ListBoxSection`, `Header` → `rv-Header`, `ListBoxLoadMoreItem` → `rv-ListBoxLoadingIndicator` |
| GridList, Tree, NavigationTree, TagGroup | `rv-GridList`, `rv-GridListItem`, `rv-GridListSection`, `rv-GridListHeader`; `rv-Tree`, `rv-TreeItem`, `rv-TreeSection`, `rv-TreeHeader`; `rv-NavigationTree*`; `rv-TagGroup`, `rv-TagList`, `rv-Tag` |
| Table | `rv-Table`, `rv-TableHeader`, `rv-Column`, `rv-TableBody`, `rv-Row`, `rv-Cell`, `rv-TableFooter`, `rv-ResizableTableContainer`, `rv-ColumnResizer` |
| Menu | `rv-Menu`, `rv-MenuItem`, `rv-MenuSection` (trigger: `Button` → `rv-Button`; popover: `Popover` → `rv-Popover`) |
| Popover, Tooltip, OverlayArrow | `rv-Popover`, `rv-Tooltip`, `rv-OverlayArrow` |
| ModalOverlay, Modal, Dialog | `rv-ModalOverlay` (the underlay), `rv-Modal`, `rv-Dialog` |
| TextField, Input, TextArea, Label, Text, FieldError | `rv-TextField`, `rv-Input`, `rv-TextArea`, `rv-Label`, `rv-Text`, `rv-FieldError` |
| Checkbox, CheckboxGroup, Switch, RadioGroup, Radio | `rv-Checkbox`, `rv-CheckboxGroup`, `rv-Switch`, `rv-RadioGroup`, `rv-Radio` |
| DisclosureGroup, Disclosure, DisclosurePanel | `rv-DisclosureGroup`, `rv-Disclosure`, `rv-DisclosurePanel` |
| Select | `class` → `rv-Select`; `triggerClass` → `rv-Select-trigger`; `valueClass` → `rv-SelectValue`; `popoverClass` → `rv-Select-popover`; `listClass` → `rv-ListBox`; `optionClass` → `rv-ListBoxItem`; `sectionClass` → `rv-ListBoxSection`; `headerClass` → `rv-Header`; `labelClass` → `rv-Label`; `descriptionClass` → `rv-Text` |
| Tabs | `rv-Tabs`, `rv-TabList`, `rv-Tab`, `rv-TabPanels`, `rv-TabPanel` |
| DetailsDisclosure | `class` → `rv-DetailsDisclosure`; `summaryClass` → `rv-DetailsDisclosure-summary`; `panelClass` → `rv-DetailsDisclosure-panel` |
| Date and color components | one class per part (`rv-DateField`, `rv-DateInput`, `rv-DateSegment`, `rv-Calendar`, `rv-CalendarCell`, `rv-ColorArea`, `rv-ColorThumb`, …) |

Slotted parts carry the `slot` attribute: `Text slot="description"` renders `[slot="description"]`, `Heading slot="title"` is the dialog title. Each component page lists its parts.

## State attributes

| Attribute | Set on | Meaning |
| --- | --- | --- |
| `aria-pressed` | ToggleButton | Selected (`"true"` / `"false"`). |
| `aria-selected` | ListBox / Select / ComboBox options, tabs | Selected. |
| `aria-expanded` | the `Button` of a DialogTrigger / MenuTrigger, Select trigger | Overlay open. |
| `aria-disabled` | options, menu items, a pending Button | Disabled but focusable (stays in the list). |
| `aria-invalid` | TextField input | Invalid. |
| `open` | Disclosure `<details>` | Expanded (Tailwind `open:`). |
| `data-pressed` | Button, ToggleButton, Link, tabs, calendar cells; overlay trigger buttons while open | Pressed (pointer or key held down). |
| `data-disabled` | Button, ToggleButton, Checkbox, Switch, Radio, TextField, Tabs and tabs, ListBox options, Select, Group, date fields | Disabled. |
| `data-pending` | Button | `isPending` is true. |
| `data-selected` | ToggleButton, Checkbox, Switch, Radio, ListBox options, tabs, calendar cells | Selected. |
| `data-focused` | ListBox root and options, Select root, ComboBox options, calendar cells | Focused (options: the focused option, also virtual focus inside a ComboBox). |
| `data-focus-visible` | Select root, Group, DatePicker, Tabs root, tabs, tab panels, calendar cells | Focused by keyboard. |
| `data-focus-within` | Group, DatePicker | Focus inside. |
| `data-hovered` | Group (with a hover callback), tabs, calendar cells | Hovered. |
| `data-open` | Select, DatePicker | Popover open. |
| `data-placeholder` | `rv-SelectValue`, date segments | No value yet. |
| `data-invalid`, `data-required`, `data-readonly` | Checkbox, Switch, Radio, TextField, Select, date fields, Group | Validation state. |
| `data-indeterminate` | Checkbox | Indeterminate. |
| `data-orientation` | ListBox, Tabs, RadioGroup, CheckboxGroup, Toolbar | `"horizontal"` / `"vertical"`. |
| `data-layout`, `data-empty` | ListBox | `"stack"` / `"grid"`; no items. |
| `data-placement` | Popover, Select popover, Tooltip, OverlayArrow | Side after flipping (`"top"`, `"bottom"`, …). |
| `data-entering`, `data-exiting` | Popover, Select popover, Modal and its underlay, Tooltip, tab panels | Enter / exit animation running. |
| `data-trigger` | Popover | The component that opened it (`"DialogTrigger"`, `"MenuTrigger"`, `"ComboBox"`, …). |
| `data-closed`, `data-enter`, `data-leave`, `data-transition` | Select popover | Headless UI transition phases (Select `enter` / `leave` class props). |

Values differ (`""`, `"true"`): select on presence (`[data-selected]`, Tailwind `data-selected:`), not on a value. Hover and keyboard focus on buttons and menu items are plain CSS: `:hover`, `:focus-visible`.

## Tailwind

Pass utilities through the class props. Style state with Tailwind's built-in variants and the cdk variants:

- Built-in: `aria-pressed:`, `aria-selected:`, `aria-expanded:`, `aria-disabled:`, `aria-invalid:`, `open:`, `data-pressed:`, `data-selected:`, `data-disabled:`, `data-focused:`, `data-[placement=top]:`, `focus-visible:`, `hover:`.
- `@rivetjs/cdk/tailwind.css` (zero runtime, custom variants only):

| Variant | Selector |
| --- | --- |
| `focused:` | `[data-focused]` |
| `placement-top:`, `placement-bottom:`, `placement-left:`, `placement-right:` | `[data-placement^="top"]`, … |
| `orientation-vertical:`, `orientation-horizontal:` | `[data-orientation="vertical"]`, … |
| `entering:`, `exiting:` | `[data-entering]`, `[data-exiting]` |

```css title="src/styles.css"
@layer theme, base, rivet, components, utilities;
@import "tailwindcss";
@import "@rivetjs/cdk/tailwind.css";
@source "./**/*.{ts,tsx}";
```

```tsx
<ToggleButton class="rounded-md border px-3 py-1.5 aria-pressed:bg-teal-700 aria-pressed:text-white data-pressed:scale-95">Bold</ToggleButton>
<ListBox aria-label="Size" items={sizes} selectionMode="single" class="grid gap-0.5 rounded-lg border p-1 focused:ring-2">
  {(item) => (
    <ListBoxItem id={item.key} class="rounded px-2 py-1 data-focused:bg-slate-100 aria-selected:bg-teal-100 data-disabled:text-slate-400">
      {item.label}
    </ListBoxItem>
  )}
</ListBox>
```

The live example at the top of the page is the full version.

## Plain CSS

Leave the class props out and target the default classes and the attributes:

::example{id=styling-css}

```css title="src/styles.css"
.rv-ToggleButton[aria-pressed="true"] { background: #0f766e; color: #fff; }
.rv-Button[data-pressed] { transform: scale(0.96); }
.rv-Button[data-disabled] { opacity: 0.4; }
.rv-ListBoxItem[data-focused] { background: #f1f5f9; }
.rv-ListBoxItem[aria-selected="true"] { background: #ccfbf1; }
.rv-ListBoxItem[aria-disabled="true"] { color: #94a3b8; }
```

Overlays render at the end of `<body>`, not next to their trigger: select them by their own class (`.rv-Popover`, `[data-trigger="MenuTrigger"]`), never as a descendant of the trigger's container.

## theme.css

`@rivetjs/cdk/theme.css` is an optional starter look for the default `rv-*` classes: buttons, lists, grid lists, trees, tags, menus, popovers, tooltips, dialogs, tabs, fields, date fields, focus rings, enter / exit fades.

- In layer `rivet.theme`, every selector wrapped in `:where()`: zero specificity. Any rule of yours wins, and Tailwind utilities win when `rivet` is declared before `components, utilities`.
- Applies only to default classes. A part with your own class prop gets none of it.
- Light and dark through `light-dark()` and `color-scheme: light dark`; forced colours handled; logical properties only, so right-to-left needs nothing.
- Looks only: removing it changes no behaviour.

Tokens, on `:root`:

| Token | Default (light / dark) | Used for |
| --- | --- | --- |
| `--rv-color-accent` | `#0f766e` / `#2dd4bf` | Pressed toggle, selected tab underline, focus ring, focused date segment |
| `--rv-color-accent-text` | `#ffffff` / `#042f2e` | Text on the accent |
| `--rv-color-surface` | `#ffffff` / `#0f172a` | Backgrounds of buttons, lists, popovers, inputs |
| `--rv-color-border` | `#cbd5e1` / `#334155` | Borders |
| `--rv-color-muted` | `#64748b` / `#94a3b8` | Disabled items, descriptions, placeholders |
| `--rv-color-selected` | `#ccfbf1` / `#134e4a` | Selected options |
| `--rv-color-text` | `#0f172a` / `#e2e8f0` | Text |
| `--rv-radius` | `0.375rem` | Corner radius |
| `--rv-focus-ring` | `2px solid var(--rv-color-accent)` | Focus outline |

Override them with an ordinary rule; it beats the layered theme:

::example{id=styling-theme}

```css title="src/styles.css"
@import "@rivetjs/cdk/theme.css";

:root {
  --rv-color-accent: light-dark(#7c3aed, #a78bfa);
  --rv-color-selected: light-dark(#ede9fe, #312e81);
  --rv-radius: 0.75rem;
}
```

With Tailwind, import it after `tailwindcss` and keep the layer order line first (see [Installation](installation.md#tailwind-v4)).

## Behaviour styles are inline

Styles that behaviour depends on are set inline or from JavaScript, never through a class:

- Overlay position (`position: absolute`, coordinates, `max-height`, `--trigger-width`) from the position engine.
- Modal underlay: `position: fixed; inset: 0; z-index: 100`. Centring and the backdrop colour are looks: add them to the `ModalOverlay` `class` (`flex items-center justify-center bg-black/50`) or use theme.css.
- Popover underlay, dismiss buttons and other visually hidden text: inline styles.
- Stacking: overlays render in order at the end of `<body>`.

So no base stylesheet is needed, and replacing or dropping a class cannot break positioning, focus or dismissal.

## Overlay transitions

Overlays (Popover, Menu, Select, Modal / DialogTrigger, Tooltip, PreviewTrigger) stay mounted until their exit CSS animation or transition ends, then unmount. While it runs the element has `data-entering` / `data-exiting` (React Aria Components; Tailwind `entering:` / `exiting:`): style the starting state of a transition on `entering:`, the end state on `exiting:`, or attach keyframe animations to them. The enter starts once the overlay sits in its portal mount, so a transition keyed on `entering:` (e.g. a backdrop `transition-opacity entering:opacity-0`) runs from its starting state on every open, the first one after a resumed page load included.

::example{id=styling-transitions}

```tsx
<DialogTrigger>
  <Button>Info</Button>
  <Popover class="rounded-lg bg-white p-3 shadow-lg transition duration-150 entering:scale-95 entering:opacity-0 exiting:scale-95 exiting:opacity-0">
    <Dialog>…</Dialog>
  </Popover>
</DialogTrigger>

<MenuTrigger>
  <Button>Actions</Button>
  <Popover class="entering:animate-menu-in exiting:animate-menu-out">
    <Menu>…</Menu>
  </Popover>
</MenuTrigger>
```

- CSS keyframe animations work with `entering:` / `exiting:` (the menu above defines `--animate-menu-in` in `@theme`). theme.css fades its overlays this way.
- Select (not yet ported part by part) also takes Headless UI class props: `enter`, `enterFrom`, `enterTo`, `entered`, `leave`, `leaveFrom`, `leaveTo` (`data-closed`, `data-enter`, `data-leave`, `data-transition` phases).
- `prefers-reduced-motion`: wrap your animations in `motion-safe:` (Tailwind) or a media query; theme.css does.
- Tooltip skips the animation when moving between warm tooltips.

## Common mistakes

- **Expecting a class prop to add to the default.** It replaces `rv-*`; with theme.css, that part loses the starter look.
- **Selecting on a value.** `[data-selected="true"]` misses parts that set `data-selected=""`. Use presence.
- **Styling an overlay through its trigger's parent.** It renders at the end of `<body>`.
- **Theme overrides inside a layer after `rivet`.** Put token overrides in an unlayered rule or a later layer; `:root` overrides inside `@layer base` lose to `rivet.theme` when `base` is declared first.
