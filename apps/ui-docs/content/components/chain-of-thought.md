---
title: ChainOfThought
description: "Collapsible reasoning or agent trace: a summary trigger over a list of steps, with a shimmer while it streams."
template: reference
status: experimental
related: [components/chat-tool, components/text-shimmer, components/disclosure]
---

`ChainOfThought` shows the reasoning or the actions behind an answer without crowding it: a trigger with a summary ("Thought for 4 seconds") opens a list of steps. It is the ui [Disclosure](/components/disclosure/) (`defaultExpanded`, `isExpanded`, `onExpandedChange`), so it opens with the keyboard and animates like every disclosure.

Accessibility: the trigger is a button inside a heading (`level`, default 3) with `aria-expanded`; `Steps` is a list. Step status icons are decorative (`data-status` styles them): say the status in the label when it matters.

## Usage

```tsx
import { ChainOfThought } from "@rivetjs/ui/chain-of-thought";
```

::example{id=chain-of-thought-basic}

## Anatomy

```tsx
<ChainOfThought isStreaming={() => streaming()}>
  <ChainOfThought.Trigger>Thinking…</ChainOfThought.Trigger>
  <ChainOfThought.Content>
    <ChainOfThought.Steps>
      <ChainOfThought.Step label="Search" status="active" />
    </ChainOfThought.Steps>
  </ChainOfThought.Content>
</ChainOfThought>
```

## Streaming

`isStreaming` (value or accessor) sets `data-streaming`: the trigger label shimmers ([TextShimmer](/components/text-shimmer/)). Steps rendered from a signal list arrive in place; while streaming each new step expands in (height and fade, instant under reduced motion).

::example{id=chain-of-thought-streaming}

## Agent Trace

Each `Step` has a `status` (`complete` default, `active`, `pending`, `error`) and an optional lucide `icon` replacing the status icon. Children are the step details.

::example{id=chain-of-thought-agent-trace}

## CSS Classes

| Class                                                             | Applied                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------ |
| `chain-of-thought`                                                | root (`disclosure`); `data-expanded`, `data-streaming` |
| `chain-of-thought__heading` / `__trigger`                         | heading + trigger button                               |
| `chain-of-thought__trigger-icon` / `__label` / `__indicator`      | icon (lucide `Brain`), label, chevron                  |
| `chain-of-thought__body`                                          | disclosure body                                        |
| `chain-of-thought__steps`                                         | `Steps` (ordered list)                                 |
| `chain-of-thought__step`                                          | `Step`; `data-status`                                  |
| `chain-of-thought__step-marker` / `__step-icon`                   | rail marker + status icon                              |
| `chain-of-thought__step-body` / `__step-label` / `__step-content` | step text                                              |

## API Reference

| Prop                                                  | Type                                             | Default        |
| ----------------------------------------------------- | ------------------------------------------------ | -------------- |
| `isStreaming`                                         | `boolean \| () => boolean`                       | `false`        |
| `defaultExpanded` / `isExpanded` / `onExpandedChange` | Disclosure props                                 | collapsed      |
| `icon` (`Trigger`)                                    | `IconNode \| null`                               | lucide `Brain` |
| `level` (`Trigger`)                                   | `number`                                         | `3`            |
| `label` (`Step`)                                      | `Content`                                        | —              |
| `status` (`Step`)                                     | `"complete" \| "active" \| "pending" \| "error"` | `"complete"`   |
| `icon` (`Step`)                                       | `IconNode`                                       | status icon    |

::api{symbol="@rivetjs/ui/chain-of-thought#ChainOfThoughtRootProps"}

::api{symbol="@rivetjs/ui/chain-of-thought#ChainOfThoughtStepProps"}

## Resumability

Server-rendered collapsed or open; the Disclosure resumes on the first toggle. `isStreaming` is an attribute binding.
