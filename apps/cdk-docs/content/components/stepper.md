---
title: Stepper
description: Stepper splits a workflow into steps with linear validation, tabbed or list semantics and keyboard navigation.
template: guide
status: experimental
related: [components/tabs, components/disclosure, foundations/key-manager]
---

`Stepper` shows a workflow as a series of steps: a wizard, a checkout, an onboarding flow or a progress indicator. Steps can be linear (a step opens only when the ones before it are valid) or free.

::example{id=stepper-basic}

## Features

- Controlled or uncontrolled selection: `selectedIndex` takes a value, a two-way Signal or an accessor.
- Linear mode: `stepControl` validation (`valid` / `invalid` / `pending` accessors) blocks moving past an incomplete step; `optional`, `completed` and `editable` steps as upstream.
- Indicator types (`number`, `edit`, `done`, `error` or a custom `state`) as render props, with `showError` and `displayDefaultIndicatorType`.
- Two ARIA patterns: `semantics="tabs"` (Material's tablist, or buttons + regions when vertical) and `semantics="list"` (an ordered list with `aria-current="step"`, read-only if needed).
- Keyboard: arrow keys move between headers (wrap, Home / End, RTL), Enter / Space select.
- Resumable: nothing runs at load. Handlers are fetched when the stepper scrolls into view.

## Anatomy

```html
<div id="checkout" class="rv-Stepper" data-rv-stepper="checkout" data-orientation="horizontal" data-selected-index="0">
  <div role="tablist" aria-orientation="horizontal" aria-label="Checkout" class="rv-StepList" data-orientation="horizontal">
    <div class="rv-Step" data-index="0" data-selected="true" data-editable="true" data-state="number" data-orientation="horizontal">
      <div
        id="checkout-label-0"
        role="tab"
        tabindex="0"
        aria-selected="true"
        aria-controls="checkout-content-0"
        class="rv-StepHeader"
        data-rv-step-header="checkout"
        data-selected="true"
        data-state="number"
      >
        Cart
      </div>
    </div>
    …
  </div>
  <div id="checkout-content-0" role="tabpanel" aria-labelledby="checkout-label-0" class="rv-StepPanel" data-position="current" data-selected="true">…</div>
  <div id="checkout-content-1" role="tabpanel" hidden inert class="rv-StepPanel" data-position="next">…</div>
</div>
```

| Part                              | Element                                                                                             | Default class   | Data attributes                                                                                                                                      |
| --------------------------------- | --------------------------------------------------------------------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Stepper`                         | `<div>`; `<ol>` with `semantics="list"`                                                             | `rv-Stepper`    | `data-rv-stepper`, `data-orientation`, `data-selected-index`, `data-readonly`                                                                        |
| `StepList`                        | `<div>` (`role="tablist"` for a horizontal tabs stepper)                                            | `rv-StepList`   | `data-orientation`                                                                                                                                   |
| `Step`                            | `<div>`; `<li>` with `semantics="list"`                                                             | `rv-Step`       | `data-index`, `data-selected`, `data-completed`, `data-invalid`, `data-disabled`, `data-optional`, `data-editable`, `data-state`, `data-orientation` |
| `StepHeader`                      | `<div role="tab">` / `<div role="button">` (vertical); `<button>` (list); `<div>` (list, read-only) | `rv-StepHeader` | `data-rv-step-header`, `data-selected`, `data-completed`, `data-invalid`, `data-disabled`, `data-state`, `data-hovered`, `data-focus-visible`        |
| `StepLabel`                       | `<div>`                                                                                             | `rv-StepLabel`  | `data-selected`, `data-invalid`                                                                                                                      |
| `StepPanel`                       | `<div>` (`role="tabpanel"` / `"region"`)                                                            | `rv-StepPanel`  | `data-position` (`previous` / `current` / `next`), `data-selected`                                                                                   |
| `StepperNext` / `StepperPrevious` | cdk `Button`                                                                                        | `rv-Button`     | Button attributes                                                                                                                                    |

Ids: headers `<stepper id>-label-<index>`, panels `<stepper id>-content-<index>` (the stepper id defaults to a generated one).

## Import

```ts
import { Stepper, StepList, Step, StepHeader, StepLabel, StepPanel, StepperNext, StepperPrevious, useStepper, useStep } from "@rivetjs/cdk/stepper";
// state machine without components
import { createStepperState, selectStep, stepCompleted } from "@rivetjs/cdk/stepper/state";
```

```tsx
<Stepper>
  <StepList aria-label="Checkout">
    <Step label="Cart">
      <StepHeader />
    </Step>
    <Step label="Payment">
      <StepHeader />
    </Step>
  </StepList>
  <StepPanel index={0}>
    … <StepperNext>Next</StepperNext>
  </StepPanel>
  <StepPanel index={1}>
    … <StepperPrevious>Back</StepperPrevious>
  </StepPanel>
</Stepper>
```

## API

Every part takes `class` (a string or a function of its render props; it replaces the default `rv-*` class), `style`, `ref`, `id`, `render`, `children` (a function of the render props, or content) and every global DOM attribute and event.

### Stepper

| Prop                          | Type                                       | Default        | Notes                                                                                       |
| ----------------------------- | ------------------------------------------ | -------------- | ------------------------------------------------------------------------------------------- |
| `selectedIndex`               | `number \| Signal<number> \| () => number` | none           | Controlled selection; a Signal is two-way.                                                  |
| `defaultSelectedIndex`        | `number`                                   | `0`            | Uncontrolled initial step.                                                                  |
| `onSelectedIndexChange`       | `(index: number) => void`                  | none           | Upstream `selectedIndexChange`.                                                             |
| `onSelectionChange`           | `(event: StepperSelectionEvent) => void`   | none           | `selectedIndex`, `previouslySelectedIndex`, `selectedStep`, `previouslySelectedStep`.       |
| `linear`                      | `boolean \| () => boolean`                 | `false`        | Previous steps must be completed (or optional) before a later one can be selected.          |
| `orientation`                 | `"horizontal" \| "vertical" \| accessor`   | `"horizontal"` | Changes the ARIA roles (tabs semantics) and the arrow keys.                                 |
| `showError`                   | `boolean`                                  | `false`        | Steps that are invalid after an interaction show the `error` state.                         |
| `displayDefaultIndicatorType` | `boolean`                                  | `true`         | `false`: completed steps report `done` / custom states as upstream's non-default indicator. |
| `semantics`                   | `"tabs" \| "list"`                         | `"tabs"`       | ARIA pattern (read once); see [Accessibility](#accessibility).                              |
| `isReadOnly`                  | `boolean`                                  | `false`        | List semantics: headers are plain elements (display only).                                  |

| Render prop (accessor) | Value                      |
| ---------------------- | -------------------------- |
| `selectedIndex()`      | the selected index         |
| `stepCount()`          | number of registered steps |
| `orientation()`        | the orientation            |

### StepList

The header strip. `aria-label` / `aria-labelledby` land here (the tablist). Render props as `Stepper`.

### Step

| Prop           | Type                            | Default | Notes                                                                                           |
| -------------- | ------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `label`        | `string`                        | none    | Plain text label; the default content of `StepHeader` / `StepLabel`.                            |
| `stepControl`  | `StepControl`                   | none    | `{ valid, invalid?, pending?, reset? }`: booleans or accessors; `reset()` is called by `reset`. |
| `optional`     | `boolean \| accessor`           | `false` | Linear mode can move past it while incomplete.                                                  |
| `editable`     | `boolean \| Signal \| accessor` | `true`  | `false`: once completed it cannot be selected again.                                            |
| `completed`    | `boolean \| Signal \| accessor` | derived | Overrides completion (default: interacted and valid).                                           |
| `hasError`     | `boolean \| Signal \| accessor` | derived | Overrides the error state (default: interacted and invalid).                                    |
| `errorMessage` | `string`                        | none    | Text for an error state (read it from `useStep()` in your header).                              |
| `state`        | `StepState \| accessor`         | none    | Custom indicator type when completed / not editable.                                            |
| `onInteracted` | `() => void`                    | none    | First attempt to move away from the step.                                                       |

| Render prop (accessor)                                                                                     | Value                                                                |
| ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `index()`                                                                                                  | position among the stepper's steps                                   |
| `isSelected()`, `isCompleted()`, `hasError()`, `isNavigable()`, `isOptional()`, `isEditable()`, `isLast()` | step state (`isLast` is exact once every step rendered: client side) |
| `state()`                                                                                                  | indicator type: `number` / `edit` / `done` / `error` / custom        |
| `orientation()`                                                                                            | the stepper's orientation                                            |

### StepHeader / StepLabel

Inside a `Step`. `StepHeader` selects its step on click / Enter / Space (when navigable) and handles the arrow keys; its default content is the step `label`. Render props: the step's. `onClick`, `onPointerEnter`, `onPointerLeave` run after the header's own handling.

### StepPanel

| Prop    | Type     | Default              | Notes                                                                    |
| ------- | -------- | -------------------- | ------------------------------------------------------------------------ |
| `index` | `number` | the enclosing `Step` | Which step's content this is; omit it inside a `Step` (vertical layout). |

Unselected panels are `hidden` + `inert`. Render props: `index()`, `isSelected()`, `position()`.

### StepperNext / StepperPrevious

cdk `Button`s that call `next()` / `previous()` (upstream `type` defaults: `"submit"` / `"button"`). Every Button prop; `onPress` runs too.

### useStepper / useStep

`useStepper()` (inside a `Stepper`) returns `{ state, selectedIndex(), stepCount(), orientation(), select(index), next(), previous(), reset() }`. `useStep()` (inside a `Step`) returns the step render props.

::api{symbol="@rivetjs/cdk/stepper#Stepper"}

## Linear steppers and validation

With `linear`, a step can only be selected when every step before it is completed (or `optional`). `stepControl` is the validation hook: any object of accessors works, a `@rivetjs/forms` form or a `computed`. A step is completed once the user moved away from it (interacted) while it was valid; `completed` overrides that.

::example{id=stepper-linear}

## Vertical steppers

`orientation="vertical"` puts each panel under its header: put `StepPanel` inside the `Step` without an `index`. Headers become `role="button"` with `aria-expanded` and `aria-current="step"`; panels become `role="region"`; Arrow Up / Down move between headers.

::example{id=stepper-vertical}

## List semantics

Without panels (a progress indicator, a timeline) a tablist is the wrong pattern. `semantics="list"` renders an `ol` of `li`s, the current one `aria-current="step"`, and native `<button>` headers in the Tab order. `isReadOnly` renders the headers as plain elements.

::example{id=stepper-list}

## DOM events and attributes

- `Stepper`, `StepList`, `Step`, `StepPanel`: global attributes and events land on their element.
- `StepHeader`: owns `onClick` (selects), `onKeyDown` (arrows, tabs semantics), `onPointerEnter` / `onPointerLeave` (`data-hovered`), focus (`data-focus-visible`); your handlers run after.
- `on*Capture` handlers do not resume yet.

## Styling

Default classes `rv-Stepper`, `rv-StepList`, `rv-Step`, `rv-StepHeader`, `rv-StepLabel`, `rv-StepPanel` (replaced by `class`). Style states with the ARIA attributes (`[aria-selected]`, `[aria-current]`, `[aria-disabled]`, `[aria-expanded]`) and the `data-*` attributes above; animate panels with `data-position` (`previous` / `current` / `next`, RTL-aware). Nothing is styled by the cdk: `hidden` is the only behaviour-critical state.

## Accessibility

| Pattern                      | Markup                                                                                                                                                                          |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabs`, horizontal (default) | `StepList` `role="tablist"` + `aria-orientation`; headers `role="tab"`, `aria-selected`, `aria-controls`; panels `role="tabpanel"` labelled by their header; roving `tabindex`. |
| `tabs`, vertical             | headers `role="button"`, `aria-expanded`, `aria-current="step"` on the selected one, `aria-controls`; panels `role="region"`.                                                   |
| `list`                       | `ol` / `li` (`aria-current="step"`), native buttons (or plain elements when read-only).                                                                                         |

Non-navigable headers carry `aria-disabled="true"`. `aria-posinset` / `aria-setsize` are not written (the set size is unknown while the server renders the first steps; browsers derive both from the tabs).

| Key                                | Action (tabs semantics)                                     |
| ---------------------------------- | ----------------------------------------------------------- |
| :kbd[ArrowRight] / :kbd[ArrowLeft] | next / previous header (horizontal; mirrored in RTL; wraps) |
| :kbd[ArrowDown] / :kbd[ArrowUp]    | next / previous header (vertical)                           |
| :kbd[Home] / :kbd[End]             | first / last header                                         |
| :kbd[Enter] / :kbd[Space]          | select the focused step                                     |

List semantics: native buttons in the Tab order (no arrow keys).

## Resumability

The server renders every step and the selected panel; no stepper code runs at load. The root has `preload="visible"`: its handlers are fetched once it scrolls into view, so the first click is synchronous.

## Upstream

- Ported: `CdkStepper` (`selectedIndex`, `linear`, `orientation`, `next`, `previous`, `reset`, `selectionChange`, `selectedIndexChange`, `STEPPER_GLOBAL_OPTIONS` as `showError` / `displayDefaultIndicatorType`), `CdkStep` (`stepControl`, `label`, `errorMessage`, `state`, `editable`, `optional`, `completed`, `hasError`, `interacted`), `CdkStepHeader`, `CdkStepLabel`, `CdkStepperNext` / `CdkStepperPrevious`, the key manager behaviour, Material's header ARIA; tests ported from Material's `stepper.spec.ts` (subset).
- Deviations: components instead of directives; `StepControl` is an object of accessors (no `AbstractControl`); a `completed` / `hasError` / `editable` accessor is read live and not cleared by `reset()` (pass a Signal); `semantics="list"` and `isReadOnly` are Rivet additions.
- Not yet supported: animations (style `data-position` yourself), Material's intl labels and icon overrides.
