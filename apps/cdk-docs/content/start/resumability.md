---
title: Resumability
description: How @rivetjs/cdk components resume - what the server HTML holds, lazy children and render props, callbacks that resume, props that read signals, current limits.
template: guide
status: experimental
related: [start/introduction, start/styling, components/overview, foundations/overview, foundations/overlays]
---

A Rivet page is rendered on the server and **resumed** in the browser: no component re-runs on load, and a component's browser code loads only when it is needed. cdk components are built for this. After this page you know what the visitor gets before any code loads, and the few rules your code must follow so callbacks and overlay content keep working. Background: [Resuming](site:docs/learn/resuming/) and [Loading code](site:docs/learn/loading-code/) in the main docs.

## What ships before interaction

The server HTML of a ToggleButton and a ListBox (from the example below, runtime markers removed):

```html
<button type="button" id="mute" class="…" aria-pressed="false">Mute</button>
<div id="color" role="listbox" aria-label="Color" aria-orientation="vertical" data-orientation="vertical"
     data-layout="stack" tabIndex="-1" data-rk="ArrowDown ArrowUp Home End PageUp PageDown Space Enter">
  <div id="color-option-red" role="option" data-key="red" aria-selected="false" tabIndex="0">Red</div>
  <div id="color-option-green" role="option" data-key="green" aria-selected="false" tabIndex="-1">Green</div>
  <div id="color-option-blue" role="option" data-key="blue" aria-selected="false" tabIndex="-1">Blue</div>
</div>
```

- **Full ARIA state.** Roles, names, `aria-selected`, `aria-pressed`, `aria-expanded`, the roving tab stop, hidden tab panels: screen readers and Tab work before any JavaScript.
- **Native behaviour.** Buttons are `<button>`, fields are inputs, Disclosure is `<details>`, Select and ComboBox submit through hidden form fields: forms post without JavaScript.
- **No component code on the critical path.** The page carries a small inline loader and a preload plan. The chunk holding a component's handlers and bindings (by default the route's chunk) is fetched on intent (hover, focus, touch), when the element is visible, or when idle; with document prefetch on, a page also downloads its own chunks after it loaded, without running them. The first event waits for its chunk and then runs as usual.
- **`data-rk` holds cold keys.** Composite widgets (ListBox, Menu, Tabs, Select, ComboBox, Toolbar, Calendar) list the keys they handle. While their code loads, the loader prevents the default action of those keys, so a first :kbd[ArrowDown] does not scroll the page; the widget's handler then runs for that key.
- **Closed overlays render nothing.** A closed Dialog, Popover, Menu or Tooltip has no markup on the server; its content is created when it opens.

## Callbacks: inline arrows or local constants

Callbacks such as `onPress`, `onChange`, `onSelectionChange`, `onAction`, `onOpenChange` are serialized into the page as references to compiled functions. Write them in your component, inline or as a local constant:

::example{id=resumability-callbacks}

```tsx title="src/routes/index.tsx"
export default function Log() {
  const log = signal("nothing yet");
  // A local constant: resumes.
  const onChange = (isSelected: boolean) => log.set(`onChange(${isSelected})`);
  return (
    <>
      {/* An inline arrow: resumes. */}
      <Button onPress={(event) => log.set(`onPress(${event.pointerType})`)}>Ping</Button>
      <ToggleButton onChange={onChange}>Mute</ToggleButton>
      <output>{log()}</output>
    </>
  );
}
```

- **Do not resume:** a function from a library Rivet did not compile, a `.bind(…)` written inside an object literal (keep it in a local constant and store that), a function built at run time and passed on. The server reports [function is not serializable](site:docs/gotchas/function-is-not-serializable/).
- Wrap foreign functions in an arrow: `onPress={() => analytics.track("save")}`.
- Values the callback captures must be serializable too: signals, plain objects, arrays, `Set`, `Map`, state from `create*State`. A callback that captures a DOM node or a class instance does not resume.

## Lazy children and render props

Plain JSX children of a component are compiled to a lazy slot that the component renders where it wants (inside its overlay, portal, focus scope and providers). Pass a function, `({ close }) => …`, where the component offers render props, or `{(item) => …}` for item renderers:

::example{id=resumability-render-children}

```tsx
<Popover trigger="Filters" title="Filters">
  {({ close }) => (
    <>
      <ToggleButton isSelected={onlyOpen}>Only open issues</ToggleButton>
      <Button onPress={() => close()}>Done</Button>
    </>
  )}
</Popover>
```

- Use a function for render props (`({ close }) => …` on Dialog / Modal / Popover, `({ placement, state }) => …` on Tooltip), item render slots (`children={(item) => …}` on ListBox, Tabs, MenuTrigger, Select), `panel` on Tabs, `renderEmptyState`.
- Plain children (text, elements, components) are fine everywhere else: a closed Popover's content is created when it opens; `<Dir>`, `I18nProvider`, `PortalProvider`, `Form` and `RouterProvider` content sees the provider's context.

## State: signals and create*State

- Two-way props take a signal: `selectedKeys={selected}`, `isSelected={pressed}`, `isOpen={open}`, `value={text}`. The component writes it, your bindings read it.
- State objects from `create*State` (`createOverlayTriggerState`, `createListState`, `createToggleState`, …) held in a `const` in your component are plain signals and JSON: they resume, and you can pass them to several components (`state={…}`).
- `default*` props (`defaultSelectedKeys`, `defaultOpen`, `defaultSelected`) for state only the component needs.

## Props update in place

Component props are live. A prop expression that reads a signal updates only the attributes and text that use it: the component is not rendered again, and keyboard focus stays where it is. This holds on a resumed page too.

```tsx
// Updates aria-invalid / data-invalid on every keystroke; the input keeps focus:
<TextField label="Email" value={email} isInvalid={!email().includes("@")} />
```

- Pass the signal itself to two-way props (`value={email}`, `selectedKeys={tab}`, `isOpen={open}`): the component writes it back. A plain value (`value={email()}`) is controlled: the component shows it and calls `onChange`, you write the signal; the component follows every change of the expression in place. Controlled values that follow: `value` (TextField, SearchField, NumberField, Slider, Select, RadioGroup, CheckboxGroup, ComboBox, the color parts, DateField, TimeField, DatePicker, DateRangePicker, Calendar, RangeCalendar), `isSelected` (Checkbox, Switch, ToggleButton), `selectedKey` (Tabs, Select, ComboBox, ToggleButtonGroup), `selectedKeys` (ListBox, GridList, TagGroup, Table, Tree, Menu, ToggleButtonGroup), `expandedKeys` (Tree, Table, DisclosureGroup), `isExpanded` (Disclosure), `inputValue` (ComboBox, Autocomplete), `isOpen` (Modal, ModalOverlay, Popover, DialogTrigger, MenuTrigger, TooltipTrigger, Tooltip).
- Every other prop is live by default, attributes included: a password toggle (`type={visible() ? "text" : "password"}`), `placeholder`, `inputMode`, `autoComplete`, `maxLength`, `aria-*` on TextField and SearchField; NumberField `minValue` / `maxValue` / `step` / `formatOptions`; Button `type`. The input keeps its value, focus and selection.
- Read once, as in React Aria: event handlers, `id`, `name`, `slot`, `ref`, props that pick the element (`elementType`, `href`, `level`), props that act only at mount (`autoFocus`), and the options a component builds its state from (`default*`, `selectionMode`, a collection root's `disabledKeys`, the `trigger` mode of MenuTrigger / DialogTrigger). Slider `minValue` / `maxValue` / `step` / `orientation`, Tabs `orientation` / `keyboardActivation` / `disabledKeys` and tooltip delays are live. Each one says "Read once at mount" in its API docs. To change one of those, re-create the component (`<Show keyed>`).
- State flags follow too, on the same elements, and handlers check the current value when the event fires: `isDisabled` / `isReadOnly` / `isInvalid` (the fields, groups, ComboBox, the color parts, the date fields, pickers and calendars) and `isRequired` (TextField, SearchField, NumberField, Select, RadioGroup, CheckboxGroup, Checkbox, SwitchField, ComboBox, ColorField, the date fields and pickers).
- Not live yet: `isRequired` of a channel `ColorField` (`channel` set), the props of the `RadioGroup` `items` preset, and a `CalendarCell`'s own `isDisabled`. Their `class`, `style` and `children` are live.

## Large collections

A collection with hundreds of items (`ListBox`, `GridList`, `Table`, `Tree`) sends each row's resume data with the page by default. Two experimental build options of the framework shrink that; both are off by default:

- **[Lazy rows](https://rivetjs.severyn.pro/learn/resuming#lazy-rows-experimental)** (`resume: { lazyRows: true }` plus `RIVET_LAZY_ROWS=on` on the server): rows are sent as their keys and rebuilt from the server HTML when first used. Selection and focus read keyed selectors, so selecting a row rebuilds that row and the one that lost the selection, not the whole list. Sections, tree children and table headers stay recorded, so the rows inside them are the lazy ones. Server time per page drops too: a 1,000-item `ListBox` renders in about 0.4× the CPU.
- **[Data from the page](https://rivetjs.severyn.pro/learn/resuming#data-from-the-page-experimental)** (`resume: { domData: true }`): item text a `ListBox` row shows is read back from the page instead of being sent twice. `GridList` rows, the options of a closed `Select` or `ComboBox` and rows a virtualizer does not render stay in the state.

Under the experimental [derived model](https://rivetjs.severyn.pro/learn/resuming#derived-model-experimental) (`resume: { model: "derived" }`) the first press on a press-based control (button, toggle, menu trigger) before its code arrives can be lost, and `ListBox`, `Select` and `TagGroup` render again in the browser on their first interaction.

## Known limits

- **`on*Capture` handlers resume.** Capture-phase props (`onPointerDownCapture`, `onWheelCapture`, …) record a capture entry on the server-rendered page and are dispatched outermost-first before the bubbling handlers, whether written as JSX attributes or spread from a props bag.
- **Chained handlers from a spread bag.** `mergeProps` (`@rivetjs/cdk/utils`, implemented in `@rivetjs/cdk/interactions/merge-props`) creates its chained handlers inside a resume-compiled module, so a merged bag resumes when spread on a native element — provided the merged handlers are themselves resumable (inline arrows, local functions, hook bags), not module-level or imported functions.
- **Client-only callbacks.** `Dir`'s `onDirChange` runs only in client-rendered trees: on a resumed page no component code runs, so read `injectDirectionality().valueSignal` in a binding instead. Likewise `clientEffect` / ref callbacks run only after the component's code loads.
- **Bare `document` in component modules.** The compiler rejects a `document` it cannot prove runs only in the browser; reach it through an element (`event.currentTarget.ownerDocument`).

## Checks

- `npm run build && npm run preview`, then watch the network panel: the HTML renders and works for reading and Tab before any script runs; handler chunks arrive afterwards, in the background (lists in view when visible or idle, buttons on intent). The docs examples print the count ("N script(s) before interaction").
- The server prints "not serializable" with the file and the capture: fix the callback or the slot, not the component.
- In development, Rivet logs accessibility warnings for markup it renders (missing names, unreachable click targets, duplicate ids); `data-rivet-a11y="off"` on `<html>` turns them off.
