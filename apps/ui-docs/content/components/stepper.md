---
title: Stepper
description: "Stepper: progress through a sequence of numbered steps with indicators, titles, descriptions and separators; interactive or display only."
template: reference
status: experimental
related: [components/progress-bar, components/pagination, components/button]
---

`Stepper` shows where the user is in a multi-step flow (checkout, onboarding, setup) as numbered indicators with titles and connecting separators. Steps before the current one are complete, the current one is active. With `onStepChange` (or a two-way Signal) every step is a button; without it the stepper is a read-only progress indicator. The behaviour is [`@rivetjs/cdk/stepper`](site:cdk/components/stepper/) (Angular CDK stepper port, list semantics).

::example{id=stepper-usage}

## Import

```tsx
import { Stepper } from "@rivetjs/ui/stepper";
```

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

## Examples

### Shorthand

A `Stepper.Step` with `title` (and `description`) and no children renders the Indicator, the Content with the Title and the Description, and the Separator, with the compound step's markup. Explicit children win: next to children `title` / `description` are ignored, with a development warning.

The form is decided once, at render: adding or removing `title` / children later does not switch it.

::example{id=stepper-shorthand}

### Bullet

An empty `Stepper.Icon` renders a dot instead of the number.

::example{id=stepper-bullet}

### Controlled

`currentStep` takes a two-way Signal (or a value / accessor); `defaultStep` sets the initial step of an uncontrolled stepper.

::example{id=stepper-controlled}

### Vertical

::example{id=stepper-vertical}

### Sizes

::example{id=stepper-sizes}

### Icons

::example{id=stepper-icons}

### Descriptions

::example{id=stepper-descriptions}

### Render function

A function child of `Stepper.Step` gets the step state: `index()`, `status()`, `isLast()` (accessors). `useStepperStep()` returns the same inside any custom part.

::example{id=stepper-render-function}

### Custom color

::example{id=stepper-custom-color}

### Display only

Without `onStepChange` and without a Signal `currentStep`, steps are plain elements (no buttons, not in the Tab order).

::example{id=stepper-display-only}

## Styling

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

| Prop (`Stepper`) | Type                                       | Default        |
| ---------------- | ------------------------------------------ | -------------- |
| `currentStep`    | `number \| Signal<number> \| () => number` | —              |
| `defaultStep`    | `number`                                   | `0`            |
| `onStepChange`   | `(index: number) => void`                  | —              |
| `orientation`    | `"horizontal" \| "vertical"`               | `"horizontal"` |
| `size`           | `"sm" \| "md" \| "lg"`                     | `"md"`         |
| `aria-label`     | `string`                                   | —              |

::api{symbol="@rivetjs/ui/stepper#StepperRootProps"}

| Prop (`Stepper.Step`) | Type      | Default |
| --------------------- | --------- | ------- |
| `title`               | `Content` | —       |
| `description`         | `Content` | —       |

`title` / `description` are the shorthand (no children): Indicator + Content(Title, Description) + Separator.

## Accessibility

- `ol` / `li` list; the current step has `aria-current="step"`.
- Interactive steppers render each step as a native `button` (Tab order, Enter / Space); give the stepper an `aria-label`.
- Completed indicators show a check icon; the status is also exposed by the step's position and `aria-current`, never by colour alone.

## Resumability

Server-rendered; nothing runs at load. A display-only stepper ships no JavaScript; an interactive one fetches its handlers when it scrolls into view.
