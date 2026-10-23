---
title: Accessible components
description: Unstyled @rivetjs/cdk components that follow the WAI-ARIA patterns, render their ARIA state on the server and keep code off the critical path.
template: guide
status: experimental
related: [foundations/overview]
---

`@rivetjs/cdk` gives you unstyled components that follow the WAI-ARIA Authoring Practices: correct roles, keyboard support and focus handling. After reading this page you can add a component, connect it to your state, style it, and know which components exist today.

The package is experimental. Its API may change.

## How it works

- **Native first where the browser is enough.** `DetailsDisclosure` is `<details>`, form fields are real inputs, buttons are `<button>`. These work before any JavaScript loads. Forms submit without JavaScript.
- **One overlay layer.** Dialogs, popovers and menus render in a div overlay layer at the end of `<body>` (React Aria `Overlay`, Angular CDK `OverlayContainer`), only while open or animating out; never the native top layer. Modal scroll lock, inert outside and focus containment are JavaScript while open.
- **Server first.** The server HTML already holds the roles, `aria-selected`, `aria-expanded`, the tab order and the hidden panels. Screen readers read the right thing before the page resumes.
- **No code on the critical path.** On a resumed page, no component code loads while the page loads. Afterwards Rivet fetches it in the background, when the visitor is about to interact, or for lists in view when the browser is idle. A cold arrow key on a list or a menu never scrolls the page while the code loads.

Install nothing extra: `@rivetjs/cdk` ships its source and the Rivet Vite plugin compiles it with your app.

## Use a component

Compose the parts (React Aria Components names), or pass `items` data, and give a signal to read or set the selection:

```tsx title="src/routes/settings.tsx"
import { signal } from "@rivetjs/reactivity";
import { Tab, TabList, TabPanel, Tabs, type Key } from "@rivetjs/cdk/tabs";
import { ListBox } from "@rivetjs/cdk/listbox";

export default function Settings() {
  const tab = signal<Key | null>("profile");
  return (
    <section>
      <Tabs selectedKey={tab}>
        <TabList aria-label="Settings">
          <Tab id="profile">Profile</Tab>
          <Tab id="billing">Billing</Tab>
          <Tab id="danger" isDisabled>
            Danger zone
          </Tab>
        </TabList>
        <TabPanel id="profile">{() => <p>Profile settings</p>}</TabPanel>
        <TabPanel id="billing">{() => <p>Billing settings</p>}</TabPanel>
        <TabPanel id="danger">{() => <p>Danger zone settings</p>}</TabPanel>
      </Tabs>
      <ListBox aria-label="Theme" items={[{ key: "light", label: "Light" }, { key: "dark", label: "Dark" }]} defaultSelectedKeys={["light"]} />
    </section>
  );
}
```

Each component has its own import path, such as `@rivetjs/cdk/tabs`. Components you do not import cost nothing.

- Pass a signal (`selectedKey={tab}`, `selectedKeys={…}`) to share the value with the rest of the page. Pass `defaultSelectedKey` / `defaultSelectedKeys` when only the component needs it.
- Change how an item looks with a function child: `children={(item) => <strong>{item().label}</strong>}`.

## Callbacks

For a callback such as a menu's `onAction`, pass any function. The browser runs the component's code on the first interaction, so the callback receives the same function it had on the server:

```tsx title="src/routes/editor.tsx"
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { Popover } from "@rivetjs/cdk/popover";
import { Menu, MenuItem, MenuTrigger } from "@rivetjs/cdk/menu";

export default function Editor() {
  const last = signal("none");
  return (
    <>
      <MenuTrigger>
        <Button>Edit</Button>
        <Popover>
          <Menu onAction={(key) => last.set(String(key))}>
            <MenuItem id="copy">Copy</MenuItem>
            <MenuItem id="paste">Paste</MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>
      <p>Last action: {last()}</p>
    </>
  );
}
```

Any function works: inline arrows, local functions, imported functions and functions from other libraries. A component given a function runs together with its parent in the browser (it is not written into the page).

## Components

Each component has its own page with the markup it renders, its props, the keys it handles, styling hooks, a live example and common mistakes.

| Component | Import | Built on |
| --- | --- | --- |
| [Button](button.md), [ToggleButton](toggle-button.md) | `@rivetjs/cdk/button`, `@rivetjs/cdk/toggle-button` | `<button>` |
| [Checkbox](checkbox.md), [CheckboxGroup](checkbox-group.md), [Switch](switch.md) | `@rivetjs/cdk/checkbox`, `@rivetjs/cdk/switch` | `<input type="checkbox">` |
| [RadioGroup](radio-group.md) | `@rivetjs/cdk/radio-group` | `role="radiogroup"` and native radios |
| [TextField](text-field.md), [TextArea](text-area.md) | `@rivetjs/cdk/text-field` | `<input>`, `<textarea>`, label, description and error message |
| [Disclosure](disclosure.md) | `@rivetjs/cdk/disclosure` | RAC `Disclosure`, `DisclosureGroup`, `DisclosurePanel` |
| [Accordion](accordion.md) | `@rivetjs/cdk/accordion` | `DisclosureGroup` + Angular CDK accordion extras (`openAll`, `closeAll`, item events) |
| [Dialog](dialog.md) | `@rivetjs/cdk/dialog` | RAC `DialogTrigger`, `Dialog` (`role="dialog"` / `alertdialog`) |
| [Modal](modal.md) | `@rivetjs/cdk/modal` | RAC `ModalOverlay`, `Modal`: blocks the page, in the overlay layer |
| [Popover](popover.md) | `@rivetjs/cdk/popover` | overlay anchored to its trigger, position engine, `OverlayArrow` |
| [Tooltip](tooltip.md) | `@rivetjs/cdk/tooltip` | hover / keyboard focus label in the overlay layer, shared warmup delay |
| [PreviewTrigger](preview-trigger.md) | `@rivetjs/cdk/preview-trigger` | hover / focus preview card of a link or button |
| [ListBox](listbox.md) | `@rivetjs/cdk/listbox` | single or multiple selection, typeahead |
| [GridList](grid-list.md) | `@rivetjs/cdk/grid-list` | interactive list rows with actions, checkboxes, links |
| [Table](table.md) | `@rivetjs/cdk/table` | rows and columns, sorting, selection, column resizing |
| [Tree](tree.md), [NavigationTree](navigation-tree.md) | `@rivetjs/cdk/tree`, `@rivetjs/cdk/navigation-tree` | expandable hierarchical rows; a tree of links with the current route |
| [TagGroup](tag-group.md) | `@rivetjs/cdk/tag-group` | focusable, selectable, removable tags |
| [Tabs](tabs.md) | `@rivetjs/cdk/tabs` | automatic or manual activation, vertical, right-to-left |
| [Menu](menu.md) | `@rivetjs/cdk/menu` | RAC `MenuTrigger`, `Menu`, `MenuItem`, sections, submenus |
| [Select](select.md) | `@rivetjs/cdk/select` | button + listbox popover; hidden `<select>` submits with the form |
| [ComboBox](combobox.md) | `@rivetjs/cdk/combobox` | text input that filters a list, ignoring case and accents |
| [Calendar](calendar.md) | `@rivetjs/cdk/calendar` | month grid of dates, keyboard navigation, min / max and unavailable dates |
| [RangeCalendar](range-calendar.md) | `@rivetjs/cdk/range-calendar` | a calendar that selects a start and end date |
| [DateField](date-field.md) | `@rivetjs/cdk/date-field` | segmented date input, one spin button per part (TimeField not ported yet) |
| [DatePicker](date-picker.md) | `@rivetjs/cdk/date-picker` | date field + calendar popover in the overlay layer |
| [DateRangePicker](date-range-picker.md) | `@rivetjs/cdk/date-picker` | two date fields + range calendar popover |

Every component of the site navigation has its own page (sliders, toasts, color pickers, …).

## Style components

Components are headless: no stylesheet to import. Styles behaviour depends on (modal underlay, overlay stacking, visually hidden text) are set inline or from JavaScript, so your own classes never break behaviour. Without a `class` prop, each part gets a default class such as `rv-Tab`. Style state with the `data-*` and ARIA attributes the component already sets:

```css title="src/styles.css"
.rv-Tab[data-selected] { border-bottom: 2px solid currentColor; }
.rv-ListBoxItem[aria-disabled="true"] { opacity: 0.5; }
```

- `@rivetjs/cdk/theme.css` is an optional starter look (looks only) with light and dark colours.
- `@rivetjs/cdk/tailwind.css` adds Tailwind variants: `focused:`, `placement-bottom:`, `orientation-vertical:`, `entering:` and `exiting:`.

Pass your own `class` (or `tabClass`, `itemClass` and so on) to replace a default class.

With Tailwind v4, declare the layer order before the imports, so Tailwind utilities win over the theme layer:

```css title="src/styles.css"
@layer theme, base, rivet, components, utilities;
@import "tailwindcss";
@import "@rivetjs/cdk/theme.css";
```

## Screen reader announcements

Render `<Announcer />` once in your layout. Components such as ComboBox use it to announce result counts, and you can call `announce("Saved")` from `@rivetjs/cdk/a11y`.

## Checks in development

During development, Rivet warns in the browser console about common mistakes in markup it renders: an image without `alt`, a clickable `<div>` that the keyboard cannot reach, a positive `tabIndex`, a label without a control, a button without a name, an ARIA reference to a missing id, and duplicate ids. Each warning says how to fix it. The checks never run in production builds. To turn them off, add `data-rivet-a11y="off"` to `<html>`.

## Common mistakes

- **A prop that reads a signal.** Component props are read when the component renders. `<TextField invalid={!email().includes("@")} />` reads `email`, so each change renders the whole field again and keyboard focus leaves it. Pass the signal itself (`value={email}`, `selected={tab}`), and change props such as `invalid` on submit or on blur.
- **A callback Rivet did not compile.** Inline arrows and local functions resume; functions from other libraries and a `.bind(…)` written inside an object literal do not (see [Callbacks](#callbacks)).
- **Expecting a centered modal without `theme.css`.** The underlay is fixed over the viewport inline, but centering and backdrop are looks: add them to your `ModalOverlay` `class` (`flex items-center justify-center bg-black/50`) or import `theme.css`.
- **Plain children in an overlay.** Closed dialogs and popovers render nothing; content created on open that holds resumable components needs a function child (`{() => …}` or `({ close }) => …`).
- **No `<Announcer />`.** Without it, the first announcement creates the live regions and screen readers may skip it.

New here? Read [Introduction](../start/introduction.md), [Installation](../start/installation.md), [Styling](../start/styling.md) and [Resumability](../start/resumability.md).

Build your own widgets from the same parts: [CDK](../foundations/overview.md).
