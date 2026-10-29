---
title: Stepper
description: "Stepper: progress through a sequence of numbered steps with indicators, titles, descriptions and separators; interactive or display only."
template: reference
status: experimental
related: [components/progress-bar, components/pagination, components/button]
---

`Stepper` shows where the user is in a multi-step flow (checkout, onboarding, setup) as numbered indicators with titles and connecting separators. Steps before the current one are complete, the current one is active. With `onStepChange` (or a two-way Signal) every step is a button; without it the stepper is a read-only progress indicator. The behaviour is [`@rivetjs/cdk/stepper`](site:cdk/components/stepper/) (Angular CDK stepper port, list semantics).

::example{id=stepper-usage}

## Usage

```tsx
import { signal } from "@rivetjs/reactivity";
import { Stepper } from "@rivetjs/ui/stepper";

export default function Checkout() {
  const step = signal(0);
  return (
    <Stepper aria-label="Checkout" currentStep={step} onStepChange={(index: number) => step.set(index)}>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Cart</Stepper.Title>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
      <Stepper.Step>
        <Stepper.Indicator />
        <Stepper.Content>
          <Stepper.Title>Payment</Stepper.Title>
        </Stepper.Content>
        <Stepper.Separator />
      </Stepper.Step>
    </Stepper>
  );
}
```

## Anatomy

| Part                  | Element                                                                                           | `data-slot`                            |
| --------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `Stepper` / `.Root`   | `ol`, class `stepper` (+ `stepper--vertical`, `--sm` / `--lg`)                                    | `stepper`                              |
| `Stepper.Step`        | `li` (`data-status`, `aria-current="step"` on the current) + inner `button` (interactive) / `div` | `stepper-step` / `stepper-step-button` |
| `Stepper.Indicator`   | `span`: number, lucide check when complete, or children                                           | `stepper-indicator` (`stepper-check`)  |
| `Stepper.Icon`        | `span` inside the indicator; empty = a bullet dot                                                 | `stepper-icon`                         |
| `Stepper.Content`     | `span` holding title + description                                                                | `stepper-content`                      |
| `Stepper.Title`       | `span`                                                                                            | `stepper-title`                        |
| `Stepper.Description` | `span`                                                                                            | `stepper-description`                  |
| `Stepper.Separator`   | `span` track + fill (hidden after the last step)                                                  | `stepper-separator`                    |

`data-status` on each step: `complete` (before the current step), `active`, `inactive` (after it).

Additional exported parts: `Stepper.Root`.

## Examples

### Shorthand

A `Stepper.Step` with `title` (and `description`) and no children renders the Indicator, the Content with the Title and the Description, and the Separator, with the compound step's markup. Explicit children win: next to children `title` / `description` are ignored, with a development warning.

The form is decided once, at render: adding or removing `title` / children later does not switch it.

::example{id=stepper-shorthand}

### Package Tracking

A display-only tracker: icon indicators, timestamps as descriptions, and `Stepper.Separator progress={0.5}` after the current step while the parcel is on its way.

::example{id=stepper-package-tracking}

### Bullet Steps

An empty `Stepper.Icon` renders a dot instead of the number.

::example{id=stepper-bullet}

### Controlled

`currentStep` takes a two-way Signal (or a value / accessor); `defaultStep` sets the initial step of an uncontrolled stepper.

::example{id=stepper-controlled}

### Controlled Vertical

The same two-way Signal on a vertical stepper: Back / Next buttons and the step buttons move the current step.

::example{id=stepper-controlled-vertical}

### Custom Color

::example{id=stepper-custom-color}

### Custom Color Vertical

The colour variables (`--stepper-active-color`, `--stepper-complete-color`, `--stepper-complete-fg`) work the same in either orientation.

::example{id=stepper-custom-color-vertical}

### Custom Completed Icon

`Stepper.Indicator` children replace its default number / check. In a render function, show your own icon for `status() === "complete"` and keep the number otherwise.

::example{id=stepper-custom-completed-icon}

### Display Only

Without `onStepChange` and without a Signal `currentStep`, steps are plain elements (no buttons, not in the Tab order).

::example{id=stepper-display-only}

### Dynamic Icon

The indicator icon follows the step status: a check when complete, a spinner while active, the step's own icon when upcoming. An accessor `currentStep` keeps the stepper display only while buttons outside drive it.

::example{id=stepper-dynamic-icon}

### Free Trial Timeline

::example{id=stepper-free-trial-timeline}

### Onboarding Timeline

A display-only stepper (accessor `currentStep`) can hold interactive content: the current step shows its action button. Interactive steps are buttons themselves, so do not nest buttons in them.

::example{id=stepper-onboarding-timeline}

### Render Function

A function child of `Stepper.Step` gets the step state: `index()`, `status()`, `isLast()` (accessors). `useStepperStep()` returns the same inside any custom part.

::example{id=stepper-render-function}

### Sizes

::example{id=stepper-sizes}

### Vertical

::example{id=stepper-vertical}

### Vertical Sizes

::example{id=stepper-vertical-sizes}

### Vertical With Icons

::example{id=stepper-vertical-with-icons}

### With Descriptions

::example{id=stepper-descriptions}

### With Icons

::example{id=stepper-icons}

### Import

```tsx
import { Stepper } from "@rivetjs/ui/stepper";
```

### Resumability

Server-rendered; nothing runs at load. A display-only stepper ships no JavaScript; an interactive one fetches its code when the browser is idle after the load, or on intent, and runs it on the first click ([preloading](site:docs/guides/performance/preloading/)).

## Styling Reference

The component’s parts emit these additional `data-slot` values: `stepper-separator-track`, `stepper-separator-fill`.

### Styling

| CSS variable                | Default                 | What                                  |
| --------------------------- | ----------------------- | ------------------------------------- |
| `--stepper-indicator-size`  | `2rem` (sm 1.5, lg 2.5) | indicator diameter                    |
| `--stepper-separator-size`  | `2px`                   | separator thickness                   |
| `--stepper-gap`             | `0.5rem`                | gap between indicator and content     |
| `--stepper-separator-gap`   | `0.25rem`               | space around the separator            |
| `--stepper-active-color`    | `var(--accent)`         | current step ring + title             |
| `--stepper-complete-color`  | `var(--accent)`         | completed indicators + separator fill |
| `--stepper-complete-fg`     | accent foreground       | check / number on complete            |
| `--stepper-inactive-border` | `var(--border)`         | upcoming indicators                   |
| `--stepper-inactive-fg`     | `var(--muted)`          | upcoming numbers + titles             |

`Stepper.Separator progress={0.5}` fills a separator partially (0–1; default 1 when the step is complete); `force` shows it after the last step. Every part takes `class`; `Stepper.Step` also takes `buttonClass` for the inner button. Transitions honour `prefers-reduced-motion`.

## API Reference

See the [full module API](/api/rivetjs/ui/stepper/) for every named export and part prop type.

| Prop (`Stepper`) | Type                                       | Default        |
| ---------------- | ------------------------------------------ | -------------- |
| `currentStep`    | `number \| Signal<number> \| () => number` | —              |
| `defaultStep`    | `number`                                   | `0`            |
| `onStepChange`   | `(index: number) => void`                  | —              |
| `orientation`    | `"horizontal" \| "vertical"`               | `"horizontal"` |
| `size`           | `"sm" \| "md" \| "lg"`                     | `"md"`         |
| `aria-label`     | `string`                                   | —              |

| Prop (`Stepper.Step`) | Type      | Default |
| --------------------- | --------- | ------- |
| `title`               | `Content` | —       |
| `description`         | `Content` | —       |

`title` / `description` are the shorthand (no children): Indicator + Content(Title, Description) + Separator.

::api{symbol="@rivetjs/ui/stepper#StepperRootProps"}

## Accessibility

- `ol` / `li` list; the current step has `aria-current="step"`.
- Interactive steppers render each step as a native `button` (Tab order, Enter / Space); give the stepper an `aria-label`.
- Completed indicators show a check icon; the status is also exposed by the step's position and `aria-current`, never by colour alone.

## Related Components

- [ProgressBar](/components/progress-bar/)
- [Pagination](/components/pagination/)
- [Button](/components/button/)
