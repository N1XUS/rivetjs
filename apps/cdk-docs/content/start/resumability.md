---
title: Resumability
description: How @rivetjs/cdk components resume - what the server HTML holds, lazy children and render props, callbacks, props that read signals, current limits.
template: guide
status: experimental
related: [start/introduction, start/styling, components/overview, foundations/overview, foundations/overlays]
---

A Rivet page is rendered on the server and **resumed** in the browser: no component runs on load, and a component runs over the server's HTML the first time it is used. cdk components are built for this. After this page you know what the visitor gets before any code runs, and how callbacks, overlay content and state behave. Background: [Resuming](site:docs/learn/resuming/) and [Loading code](site:docs/learn/loading-code/) in the main docs.

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
- **No component code on the critical path.** The page carries a small inline loader and a record per interactive component. After the page has loaded, the loader fetches the components' code at low priority without running it (on intent, hover or focus, at once). The first event runs the component over the server HTML and then its handler; an event that comes before the code is held and replayed.
- **`data-rk` holds cold keys.** Keyboard widgets (ListBox, Menu, Tabs, Select, Toolbar, Calendar, GridList, Tree, Slider and ColorSlider thumbs, ColorArea, ColorWheel, NumberField, ColorField, Wheel) list the keys they handle. While their code loads, the loader prevents the default action of those keys, so a first :kbd[ArrowDown] does not scroll the page; the widget's handler then runs for that key.
- **Closed overlays render nothing.** A closed Dialog, Popover, Menu or Tooltip has no markup on the server; its content is created when it opens.

## Callbacks

Callbacks such as `onPress`, `onChange`, `onSelectionChange`, `onAction`, `onOpenChange` are not sent with the page: the browser builds them again when it runs your component. Any function works: an inline arrow, a local constant, a module-level or imported function, a function from another library, a `.bind(…)`:

::example{id=resumability-callbacks}

```tsx title="src/routes/index.tsx"
export default function Log() {
  const log = signal("nothing yet");
  const onChange = (isSelected: boolean) => log.set(`onChange(${isSelected})`);
  return (
    <>
      <Button onPress={(event) => log.set(`onPress(${event.pointerType})`)}>Ping</Button>
      <ToggleButton onChange={onChange}>Mute</ToggleButton>
      <output>{log()}</output>
    </>
  );
}
```

- A component that gets a callback runs together with the component that passes it: a press on `Button` runs `Log` too, which builds `log` and the callback. Components whose props are plain data wake up on their own.

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
- State objects from `create*State` (`createOverlayTriggerState`, `createListState`, `createToggleState`, …) held in a `const` in your component are plain signals: their values travel with the component, and you can pass them to several components (`state={…}`).
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

A keyed collection (`ListBox`, `GridList`, `Table`, `Tree`) sends its items once, with the component's data, and no record per row; the browser runs a row's code when the row is used. The items of a `<For>` over a component's data props are read back from the page instead (default; `resume: { domData: false }` turns it off) ([data from the page](site:docs/learn/resuming/#data-from-the-page)). Some collection components (`ListBox`, `Select`, `TagGroup`, grid list, tree) still render again in the browser on their first interaction.

## Known limits

- **A replayed press and hover state.** A press held while its code loads is replayed with the focus a loaded page would have seen; the hover state of the pressed element (`data-hovered`) can differ from a loaded page until the pointer moves.
- **Client-only callbacks.** `Dir`'s `onDirChange` runs once the component has woken up; read `injectDirectionality().valueSignal` in a binding for the server's value.
- **Bare `document` in component modules.** The compiler rejects a `document` it cannot prove runs only in the browser; reach it through an element (`event.currentTarget.ownerDocument`).

## Checks

- `npm run build && npm run preview`, then watch the network panel: the HTML renders and works for reading and Tab before any script runs; component chunks arrive afterwards, in the background. The docs examples print the count ("N script(s) before interaction").
- Route data the page cannot carry prints a warning ([RV2107](site:docs/errors/RV2107/)): return plain data from loaders.
- In development, Rivet logs accessibility warnings for markup it renders (missing names, unreachable click targets, duplicate ids); `data-rivet-a11y="off"` on `<html>` turns them off.
