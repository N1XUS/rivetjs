---
title: ChatLoader
description: "Placeholders for an assistant turn that has not produced text yet: dots, pulse, spinner and skeleton."
template: reference
status: experimental
related: [components/chat-message, components/skeleton, components/spinner]
---

`ChatLoader` holds the loaders an AI chat shows between sending a prompt and the first token: three bouncing `Dots`, a `Pulse`, a `Spinner` (the ui Spinner) and a `Skeleton` of text lines with an optional avatar placeholder. The skeleton parts (`SkeletonAvatar`, `SkeletonBlock`, `SkeletonLine`) compose custom shapes.

Accessibility: each loader is a polite `role="status"` named by `aria-label` (default "Loading"); the moving parts are `aria-hidden`. Motion stops under `prefers-reduced-motion`.

## Usage

```tsx
import { ChatLoader } from "@rivetjs/ui/chat-loader";
```

::example{id=chat-loader-basic}

## Anatomy

```tsx
<ChatLoader.Dots aria-label="Thinking" />
<ChatLoader.Pulse />
<ChatLoader.Spinner size="sm" />
<ChatLoader.Skeleton lines={3} hideAvatar />
<ChatLoader.SkeletonBlock>
  <ChatLoader.SkeletonAvatar />
  <ChatLoader.SkeletonLine width="60%" />
</ChatLoader.SkeletonBlock>
```

## CSS Classes

| Class                                           | Applied                           |
| ----------------------------------------------- | --------------------------------- |
| `chat-loader`                                   | every loader root (`role=status`) |
| `chat-loader__dots` / `chat-loader__dot`        | `Dots`                            |
| `chat-loader__pulse` / `chat-loader__pulse-dot` | `Pulse`                           |
| `chat-loader__spinner`                          | `Spinner`                         |
| `chat-loader__avatar`                           | `SkeletonAvatar`                  |
| `chat-loader__content`                          | skeleton text column              |
| `chat-loader__line`                             | `SkeletonLine`                    |

## API Reference

| Prop                      | Type                           | Default     |
| ------------------------- | ------------------------------ | ----------- |
| `aria-label` (all)        | `string`                       | `"Loading"` |
| `size` (`Spinner`)        | `"sm" \| "md" \| "lg" \| "xl"` | `"sm"`      |
| `lines` (`Skeleton`)      | `number`                       | `3`         |
| `hideAvatar` (`Skeleton`) | `boolean`                      | `false`     |
| `width` (`SkeletonLine`)  | `string` (CSS length)          | `"100%"`    |

Every part takes `class` and `div` attributes.

::api{symbol="@rivetjs/ui/chat-loader#ChatLoaderSkeletonProps"}

::api{symbol="@rivetjs/ui/chat-loader#ChatLoaderSpinnerProps"}

## Resumability

Static markup with CSS animation: nothing runs at load.
