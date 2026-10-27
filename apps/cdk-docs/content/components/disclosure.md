---
title: Disclosure
description: "DisclosureGroup, Disclosure and DisclosurePanel from @rivetjs/cdk: sections opened by a Button slot=\"trigger\", plus DetailsDisclosure on native details."
template: guide
status: experimental
related: [components/accordion, components/overview, components/tabs]
---

A disclosure is a collapsible section: a trigger button and a panel it shows and hides. RAC composition: `Disclosure` wraps a `Heading` holding a `Button slot="trigger"` and a `DisclosurePanel`; a `DisclosureGroup` around several disclosures is an accordion (one expanded at a time unless `allowsMultipleExpanded`). The server renders the final `aria-expanded`, `hidden` and `data-expanded`; the first press loads the handler.

::example{id=disclosure-group}

The Angular CDK accordion extras (`openAll` / `closeAll`, `onOpened` / `onClosed` / `onDestroyed`, an external group state) live on these same parts; see [Accordion](accordion.md).

## Anatomy

```tsx
<DisclosureGroup>
  <Disclosure id="what">
    <Heading level={3}>
      <Button slot="trigger">What is Rivet?</Button>
    </Heading>
    <DisclosurePanel>…</DisclosurePanel>
  </Disclosure>
</DisclosureGroup>
```

```html
<div class="rv-DisclosureGroup">
  <div id="what" class="rv-Disclosure" data-expanded="true">
    <h3 class="rv-Heading"><button id="rv0-trigger" class="rv-Button" aria-expanded="true" aria-controls="rv0-panel">What is Rivet?</button></h3>
    <div id="rv0-panel" class="rv-DisclosurePanel" role="group" aria-labelledby="rv0-trigger">…</div>
  </div>
</div>
```

| Part | Element | Default class | Notes |
| --- | --- | --- | --- |
| `DisclosureGroup` | `<div>` | `rv-DisclosureGroup` | `data-disabled`; provides `DisclosureGroupStateContext`. |
| `Disclosure` | `<div>` | `rv-Disclosure` | `id` (also the group key), `data-expanded`, `data-disabled`, `data-focus-visible-within`. |
| `Button slot="trigger"` | `<button>` | `rv-Button` | `aria-expanded`, `aria-controls`; disabled with the disclosure. |
| `DisclosurePanel` | `<div>` | `rv-DisclosurePanel` | `role="group"` (or `region`), `aria-labelledby`, `hidden` while collapsed (`until-found` after the first change: find-in-page expands it), `--disclosure-panel-width` / `--disclosure-panel-height`. |

## Import

```tsx
import { Disclosure, DisclosureGroup, DisclosurePanel, DetailsDisclosure } from "@rivetjs/cdk/disclosure";
import { createDisclosureGroupState, createDisclosureState } from "@rivetjs/cdk/state/disclosure";
```

## Props

`DisclosurePanel` accepts `aria-label` and `aria-labelledby` when you need to customize its accessible name, in addition to its default trigger relationship.

### DisclosureGroup

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `allowsMultipleExpanded` | `boolean \| Signal<boolean>` | `false` | Several disclosures expanded at once (Rivet: a Signal too, Angular `multi`). |
| `expandedKeys` | `Iterable<Key> \| Signal<Set<Key>>` | none | Controlled: a plain value (only `onExpandedChange` runs) or a two-way Signal. |
| `defaultExpandedKeys` | `Iterable<Key>` | none | Uncontrolled initial keys. |
| `onExpandedChange` | `(keys: Set<Key>) => void` | none | Every change. |
| `isDisabled` | `boolean` | `false` | Disables every disclosure in the group. |
| `state` | `DisclosureGroupState` | none | Rivet: an existing state (`createDisclosureGroupState`) for `openAll` / `closeAll` from outside. |
| `class`, `style`, `children` | value or render function | | Render props: `isDisabled`, `state`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `DisclosureGroup`; see [Render](#render). |

### Disclosure

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `id` | `Key` | generated | The key inside a group; rendered as the root `id`. |
| `isExpanded` | `boolean \| Signal<boolean>` | none | Controlled (ignored inside a group: the group's keys decide). |
| `defaultExpanded` | `boolean` | `false` | Uncontrolled initial state. |
| `onExpandedChange` | `(isExpanded: boolean) => void` | none | Own toggles. |
| `isDisabled` | `boolean` | `false` | Disables the trigger. |
| `onOpened`, `onClosed`, `onDestroyed` | `() => void` | none | Angular CDK accordion item events; opened / closed also when the group collapses it. |
| `class`, `style`, `children` | value or render function | | Render props (accessors): `isExpanded()`, `isDisabled`, `isFocusVisibleWithin()`, `state`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `Disclosure`; see [Render](#render). |

### DisclosurePanel

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `role` | `"group" \| "region"` | `"group"` | |
| `class`, `style`, `children` | value or render function | | Render props: `isFocusVisibleWithin()`. |
| `render` | `(props, renderProps) => element` | none | Replaces the default `<div>` of `DisclosurePanel`; see [Render](#render). |

Every part takes the global DOM events and attributes (`dir`, `lang`, `on<Event>`, `data-*`) on its root.

## Standalone disclosures

Outside a `DisclosureGroup` each disclosure owns its state; several can be open.

::example{id=disclosure-standalone}

## Content

Put any content in the trigger (icons, badges, reactive text); keep interactive controls in the panel. Handlers in the panel resume on first use.

::example{id=disclosure-slots}

## DOM events and attributes

Global DOM events and attributes land on the part's root. The trigger's press handling stops `click` / `pointerdown` propagation (RA `usePress`).

::example{id=disclosure-dom-events}

## Styling

| Selector | Matches |
| --- | --- |
| `.rv-Disclosure[data-expanded]` | An expanded disclosure (Tailwind `data-expanded:`, `group-data-expanded:`). |
| `.rv-Disclosure[data-disabled]` | A disabled disclosure. |
| `.rv-DisclosurePanel` | The panel; animate with `--disclosure-panel-height`. |

### Tailwind

::example{id=disclosure-tailwind}

### Plain CSS

::example{id=disclosure-css}

## DetailsDisclosure

`DetailsDisclosure` (Rivet) renders native `<details>` / `<summary>` (`title`, `group` → `name`, `defaultExpanded` → `open`; classes `rv-DetailsDisclosure`, `-summary`, `-panel`): zero JavaScript, browser-owned state, no controlled props.

## Render

`render` replaces the default element with your own (React Aria Components `render`). Supported on `DisclosureGroup` (`<div>`), `Disclosure` (`<div>`), `DisclosurePanel` (`<div>`). It receives the part's props (`ref`, `class`, `style`, `data-*` state attributes, handlers, `children`) and the render props as accessors. Spread the props onto the element you return; the `ref` inside the spread attaches. Write `render` as an inline arrow so it stays resumable.

```tsx
<DisclosureGroup render={(props) => <div {...(props as {})} />}>…</DisclosureGroup>
```

## Accessibility

| Key | Action |
| --- | --- |
| :kbd[Enter], :kbd[Space] | Toggles the focused disclosure. |
| :kbd[Tab] | Moves to the next trigger or into the expanded panel. |

## Resumability

- Server HTML is final (`aria-expanded`, `hidden`, `data-expanded`); nothing runs before the first press.
- Callbacks (`onExpandedChange`, `onOpened`, …) are inline arrows or local consts.

## Upstream

Ports React Aria Components `Disclosure.tsx` (`DisclosureGroup`, `Disclosure`, `DisclosurePanel`), `@react-aria/disclosure` `useDisclosure` (`@rivetjs/cdk/disclosure/behaviour`: `disclosureProps`) and `@react-stately/disclosure`, plus the Angular CDK accordion extras.

### Not yet supported

- The server renders boolean `hidden`, not `hidden="until-found"` (runtime boolean attribute), until the first change.
