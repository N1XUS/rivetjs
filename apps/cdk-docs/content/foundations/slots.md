---
title: Slots and render props
description: "@rivetjs/cdk/slots: Provider, contextProps, renderProps, createSlot and createSlotId - how containers pass props to the parts inside them."
template: guide
status: experimental
related: [components/heading, components/label, components/separator, components/keyboard, foundations/props-and-values]
---

Composed components in `@rivetjs/cdk` (Dialog, fields, menus) don't render their titles, labels and help text themselves. Instead, they **provide props** to the parts you place inside them. Each part (`Heading`, `Text`, `Label`, `Input`, `Keyboard`, …) reads its context and merges those props with its own. This module, a port of React Aria Components `utils.tsx`, is the contract for that. Use it to build your own containers the same way.

::example{id=slots-provider}

## Import

```ts
import { Provider, contextProps, slottedContext, renderProps, composeRenderProps, createSlot, createSlotId, slotIdRef, DEFAULT_SLOT } from "@rivetjs/cdk/slots";
```

## Provider

`<Provider values={[[Context, value], …]}>` nests one context provider per entry, outermost first. A value is either:

- props for every part that reads the context, or
- `{ slots: { name: props, [DEFAULT_SLOT]: props } }`: props chosen by the part's `slot` prop.

| Part `slot` | Value has `slots` | Result |
| --- | --- | --- |
| omitted | no | the props |
| omitted | yes | the `DEFAULT_SLOT` entry; throws `A slot prop is required` when there is none |
| `"name"` | yes | that entry; throws `Invalid slot "name"` when it is missing |
| `null` | either | no context props (opt out) |

## contextProps

A part calls `const [merged, ref] = contextProps(props, props.ref, MyContext)`.

- Own props win over context props.
- Event handlers chain, context handler first.
- `class` values join and `id`s merge.
- `style` objects merge, and style functions compose.
- Refs merge: with one ref you get that ref; with two you get a fresh `ref()` that copies the element to both.

Context values may be **accessors** (`"aria-invalid": () => invalid()`, `children: () => title()`). They pass through untouched and are read inside bindings, so the part updates in place, on resumed pages too.

## renderProps

`renderProps({ class, style, children, values, defaultClassName })` returns `{ class(), style(), children() }`, which you read inside bindings.

- `values` holds accessors (`{ isHovered: () => boolean }`).
- A `class` / `style` / `children` function receives those accessors plus `defaultClassName` / `defaultStyle` / `defaultChildren`.

::example{id=slots-render-props}

`composeRenderProps(value, wrap)` wraps a user value (static or a function) with your own logic.

## createSlot and createSlotId

`createSlot()` returns `[ref, hasSlot]`. Put the ref on a slotted part through its context value: `hasSlot()` is true while that element is attached. On the server it is the initial state, or `true` once the part rendered earlier in the same render: a `Label` marks its slot when it renders, so a TagList with `aria-label` and a visible Label names the Label in the server HTML too (React Aria `useSlot`). A part that renders after the owner's attributes keeps the initial state.

`createSlotId(id?, deps?)` ports React Aria `useSlotId`. Use it for an optional part referenced by `aria-describedby` / `aria-labelledby`:

- The id starts present on the first client render.
- After mount, a client effect checks `document.getElementById(id)` and drops the id when no element has it.
- The check re-runs when signals read by `deps` change.
- A part that takes the slot id as its context `id` reports itself directly.
- A part with its own `id` prop keeps it (React Aria `mergeIds`): `slotIdRef` then returns that id, so `<Heading slot="title" id="x">` labels its Dialog as `x`, also in the server HTML.
- Server render: no check effect, so a resumed page does not start the runtime for it. The id stays in the server HTML while its part may still render (`slotIdRef(slotId, expected)`, default `true`; a FieldError passes the field's validity).
- Server slot probe: ComboBox, Select, TextField, SearchField, NumberField, CheckboxGroup / CheckboxField, SwitchField, RadioGroup / RadioField, DateField, DatePicker, ColorField, ListBox and Menu items and alert dialogs run their children once on the server before writing the attribute (`probeSlots` from `@rivetjs/cdk/slot-probe`), so it names only the description, error, label and value parts that render. Field children therefore render twice on the server: keep them pure (effects created during the probe never run; its scope is disposed). Browser builds resolve the probe to a no-op (0 bytes). The choice is the `browser` export condition: a server bundle must resolve `@rivetjs/cdk` without it (Node, and the Rivet adapters' server builds, do). A server build that sets `browser` (some edge / worker bundler configs) gets the no-op, and the attributes can then name parts that never render; in development the server warns once (`cdk slot probe is disabled: …`).

Read it as `aria-describedby={slotIdRef(slotId)}`. `deps` must be a signal or a local const, not an inline arrow argument.

:::note
Deviation from React Aria: on a resumed page, a server id whose part never rendered stays in the attribute until that binding updates for another reason. Assistive technology ignores an id with no element.
:::

::example{id=slots-slot-id}

## Pressable, PressResponder and Focusable

The same idea applies to interactions:

- `PressResponder` passes press handlers to the nearest pressable inside it.
- `FocusableProvider` passes DOM props to the nearest `Focusable`.
- `Pressable` / `Focusable` (`@rivetjs/cdk/interactions/pressable`, `@rivetjs/cdk/focusable`) take a **render function** child. Spread the props on your element and pass `ref={p.ref}`, because a spread never sets `ref`.

::example{id=pressable-responder}

## Styling

Parts keep RAC's default classes (`rv-Heading`, `rv-Text`, `rv-Label`, `rv-Separator`, `rv-Input`, `rv-TextArea`, `rv-Header`) and `data-*` state. Tailwind variants from `@rivetjs/cdk/tailwind.css` work on them:

::example{id=parts-tailwind}

## Resumability

- Every part context is registered for resume (`rv-heading`, `rv-text`, `rv-label`, `rv-input`, …), so a region re-created on a resumed page still sees its container's props.
- Provided values must serialize: plain data, signals, `ref()`, and inline-arrow or local-const functions.

## Upstream

- React Aria Components `utils.tsx`: `useContextProps` → `contextProps`, `useSlottedContext` → `slottedContext`, `useRenderProps` → `renderProps`, `useSlot` → `createSlot`, `Provider`, `composeRenderProps`, `DEFAULT_SLOT`.
- React Aria `useSlotId` → `createSlotId` / `slotIdRef`.
- `Pressable`, `PressResponder`, `useFocusable` → `focusableProps`, `Focusable`, `FocusableProvider`.
- Deviations:
  - no `data-rac`; `render` (`DOMRenderProps`, `DOMRenderFunction`) is a per-part prop, re-exported here;
  - `DEFAULT_SLOT` is a string (it must serialize);
  - `Pressable` / `Focusable` take a render-function child instead of cloning their child.

## Common mistakes

- **Leaving `style` in a spread.** An element spread rejects `style`. Destructure it and bind `style={…}`.
- **Storing JSX with a `Show` in a const and inserting it later.** On resumed pages that region stops updating. Render it inline.
