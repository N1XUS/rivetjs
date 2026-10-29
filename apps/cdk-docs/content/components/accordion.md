---
title: Accordion
description: "@rivetjs/cdk/accordion: DisclosureGroup + Disclosure with the Angular CDK accordion extras: single or multiple expansion, openAll / closeAll, item events."
template: guide
status: experimental
related: [components/disclosure, components/tabs, foundations/ids]
---

An accordion is a `DisclosureGroup` of `Disclosure`s: at most one expanded at a time unless `allowsMultipleExpanded`. `@rivetjs/cdk/accordion` re-exports the [Disclosure](disclosure.md) parts. The Angular CDK accordion features (`multi`, `openAll()` / `closeAll()`, `(opened)` / `(closed)` / `(destroyed)`) live on those same parts, so there is one implementation and one API.

::example{id=accordion-single}

## Anatomy

```tsx
<DisclosureGroup>
  <Disclosure id="shipping">
    <Heading level={3}>
      <Button slot="trigger">Shipping</Button>
    </Heading>
    <DisclosurePanel>Orders ship within two business days.</DisclosurePanel>
  </Disclosure>
  …
</DisclosureGroup>
```

Rendered markup, parts, classes and data attributes: see [Disclosure → Anatomy](disclosure.md#anatomy).

## Import

```tsx
import {
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  createDisclosureGroupState,
  openAll,
  closeAll,
  toggleKey,
  setExpandedKeys,
  isKeyExpanded,
} from "@rivetjs/cdk/accordion";
```

## Angular CDK mapping

| Angular CDK | Rivet |
| --- | --- |
| `cdkAccordion` | `<DisclosureGroup>` |
| `cdkAccordionItem` | `<Disclosure id>` |
| `[multi]` | `allowsMultipleExpanded` (boolean or `Signal<boolean>`) |
| `[expanded]`, `(expandedChange)` | `isExpanded` / `defaultExpanded`, `onExpandedChange`; in a group: `expandedKeys` / `defaultExpandedKeys` |
| `[disabled]` | `isDisabled` (also on the group) |
| `(opened)`, `(closed)`, `(destroyed)` | `onOpened`, `onClosed`, `onDestroyed` |
| `openAll()`, `closeAll()` | `openAll(state)`, `closeAll(state)` with `<DisclosureGroup state={state}>` |
| `toggle()`, `open()`, `close()` | `toggleKey(state, key)`, `setExpandedKeys(state, keys)` |

Props tables: [Disclosure → Props](disclosure.md#props).

## Single and multiple expansion

By default opening one disclosure closes the open one (the hero example). `allowsMultipleExpanded` lets them open independently.

::example{id=accordion-multi}

## Controlled state

`expandedKeys` on the group and `isExpanded` on a standalone disclosure take a plain value (controlled: only the callback runs) or a two-way Signal.

::example{id=accordion-controlled}

## Open all, close all

Create the group state yourself (`createDisclosureGroupState`) and pass it as `state`: `openAll` expands every enabled disclosure (only with multiple expansion), `closeAll` collapses every enabled one; disabled disclosures keep their state.

::example{id=accordion-programmatic}

## Disabled items

::example{id=accordion-disabled}

## Events

`onExpandedChange` reports the disclosure's own toggles; `onOpened` / `onClosed` fire on every change, also when the group collapses it; `onDestroyed` when a client-rendered disclosure is removed.

::example{id=accordion-events}

## Nested accordions

A `DisclosureGroup` inside a panel owns its disclosures; opening an inner one does not close the outer one.

::example{id=accordion-nested}

## DOM events and attributes

::example{id=accordion-dom-events}

## Styling

### Tailwind

::example{id=accordion-tailwind}

### Plain CSS

::example{id=accordion-css}

## Keyboard and accessibility

Use a heading around each trigger button and meaningful trigger text. :kbd[Enter] or :kbd[Space] toggles a focused trigger; :kbd[Tab] moves between focusable controls. The group does not add an arrow-key navigation system. Panels expose the expanded trigger's relationship through ARIA; see [Disclosure accessibility](disclosure.md#accessibility).

## Resumability

- Server HTML is final; nothing runs before the first press.
- The group state holds signals, keys and your callbacks: a handler that uses a state from `createDisclosureGroupState` works on the resumed page.
- `onOpened` / `onClosed` compare against the server-rendered state, so a resumed page reports the first change correctly.

## Testing

The group state functions run without a DOM:

```ts
import { createDisclosureGroupState, registerDisclosure, openAll, isKeyExpanded } from "@rivetjs/cdk/accordion";
import { untrack } from "@rivetjs/reactivity";

const state = createDisclosureGroupState({ allowsMultipleExpanded: true });
registerDisclosure(state, "a");
registerDisclosure(state, "b");
openAll(state);
console.assert(untrack(() => isKeyExpanded(state, "b")));
```

## Upstream

Ports Angular CDK `src/cdk/accordion` (`CdkAccordion`, `CdkAccordionItem`, `UniqueSelectionDispatcher` coordination) onto React Aria Components `Disclosure` / `DisclosureGroup` (user decision 2026-10-06: one module).

### Not yet supported

- Angular `_stateChanges` (Material-only relay): read the signals.
- Event order: events fire in disclosure render order (`one opened, one closed, two opened`), not Angular's dispatcher order.
