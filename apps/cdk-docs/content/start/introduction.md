---
title: Introduction
description: What @rivetjs/cdk is - headless accessible components and a low-level CDK, ported from React Aria and Angular CDK, server-first and resumable.
template: guide
status: experimental
related: [start/installation, start/styling, start/resumability, components/overview, foundations/overview]
---

`@rivetjs/cdk` is the accessibility and interaction layer of Rivet. It has two halves:

- **Components**: headless, accessible widgets (Button, ListBox, Select, ComboBox, Menu, Tabs, Dialog, Popover, Tooltip, DatePicker, …). They render correct roles, ARIA state, keyboard handling and focus management, and no styles.
- **CDK**: the parts the components are built from, for your own widgets: ids, focus scopes, key managers, collections and selection, overlays and positioning, live announcements, bidi, layout, observers, clipboard, virtual scrolling.

The package is experimental. Its API may change.

::example{id=resumability-callbacks}

```tsx title="src/routes/index.tsx"
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { ListBox, type Selection } from "@rivetjs/cdk/listbox";

export default function Page() {
  const color = signal<Selection>(new Set(["red"]));
  return (
    <>
      <ListBox aria-label="Color" items={[{ key: "red", label: "Red" }, { key: "blue", label: "Blue" }]} selectionMode="single" selectedKeys={color} />
      <Button onPress={() => color.set(new Set(["blue"]))}>Pick blue</Button>
    </>
  );
}
```

## Ported, not reinvented

Each module is a faithful port of an upstream library, with its tests. Names and behaviour follow upstream, so upstream docs and knowledge carry over.

| Upstream | What it gives here | Example |
| --- | --- | --- |
| React Aria (hooks) | Behaviour: press, hover, focus, keyboard, move, long press, interact outside, focus rings, overlays, position engine, selection managers, live announcer, i18n | `@rivetjs/cdk/interactions/press`, `@rivetjs/cdk/position` |
| React Aria Components | Component API: prop names (`isDisabled`, `onPress`, `selectedKeys`, `onSelectionChange`, `isOpen`, `onOpenChange`), default class names (`rv-Button` for RAC `react-aria-Button`), render state as `data-*` attributes (`data-pressed`, `data-selected`, `data-focused`, `data-entering`, …), global DOM events and attributes on every part | `@rivetjs/cdk/button`, `@rivetjs/cdk/listbox` |
| React Stately | State objects as plain signals (`createListState`, `createOverlayTriggerState`, `createToggleState`, …) | `@rivetjs/cdk/state/list` |
| Angular CDK | a11y (FocusTrap, FocusMonitor, key managers, LiveAnnouncer, InteractivityChecker, high contrast), overlay (OverlayRef, connected / global position, scroll strategies), portal, bidi, layout (BreakpointObserver), observers, clipboard, coercion, text-field autosize, scrolling (virtual scroll), collections (`SelectionModel`, `DataSource`); the drag-drop engine is ported but has no import path yet | `@rivetjs/cdk/a11y/focus-trap`, `@rivetjs/cdk/layout` |
| @internationalized/date | Calendar dates, time zones, calendars, formatting | `@rivetjs/cdk/date` |

Where upstream and Rivet disagree (resumability, no React), the source file header names the deviation.

## Server first and resumable

- The server HTML already holds roles, `aria-selected`, `aria-expanded`, `aria-pressed`, tab stops and hidden panels. Screen readers and keyboard users get the right state before any JavaScript runs.
- No component code is on the critical path. Rivet resumes the page: a component's handlers load on intent (hover, focus, touch), when visible or when idle, in the background after the page is shown; nothing blocks the first render.
- Composite widgets list the keys they handle in `data-rk`, so a cold arrow key does not scroll the page while the code loads.
- Native elements where they are enough: buttons are `<button>`, fields are real inputs, Disclosure is `<details>`. Forms submit without JavaScript.

Rules for code that resumes (callbacks, overlay content, props that read signals): [Resumability](resumability.md).

## One div overlay layer

Dialogs, popovers, menus, the Select list, tooltips and date picker calendars render in a div overlay layer at the end of `<body>` (React Aria `Overlay`, Angular CDK `OverlayContainer`), only while open or animating out. No native `<dialog>` and no `popover` attribute: the layer stacks with your own portals, animates out, and handles Escape the same way everywhere. Modal scroll lock, `inert` outside and focus containment run while open. See [Overlays](../foundations/overlays.md).

## Headless

No stylesheet to import. Behaviour-critical styles (positioning, stacking, visually hidden text, the modal underlay) are set inline from JavaScript, so your classes cannot break behaviour. Style with Tailwind or plain CSS on the default `rv-*` classes and the ARIA / `data-*` state attributes; `@rivetjs/cdk/theme.css` is an optional starter look. See [Styling](styling.md).

## Where to go next

- [Installation](installation.md): add the package, import paths, Tailwind setup.
- [Styling](styling.md): class names, state attributes, Tailwind variants, theme tokens, transitions.
- [Resumability](resumability.md): what ships before interaction, render-function children, callbacks.
- [Testing](testing.md): Vitest browser mode, `@rivetjs/testing/user` testers, server render tests.
- [Components](../components/overview.md): every component, with props, keyboard and live examples.
- [CDK](../foundations/overview.md): the low-level modules for your own widgets.
