---
title: ChatMessageActions
description: "A row of icon buttons under a message: copy, regenerate, rating, share or your own."
template: reference
status: experimental
related: [components/chat-message, components/toolbar]
---

`ChatMessageActions` is a compact toolbar for one message. `Action` is a ghost, small, icon-only [Button](/components/button/); `Copy` writes `text` to the clipboard and swaps its icon to a check for a moment.

## Usage

```tsx
import { ChatMessageActions } from "@rivetjs/ui/chat-message-actions";
```

::example{id=chat-message-actions-basic}

## Anatomy

```tsx
<ChatMessageActions>
  <ChatMessageActions.Copy text={answer} />
  <ChatMessageActions.Action aria-label="Regenerate">
    <Icon icon={RotateCcw} size={16} />
  </ChatMessageActions.Action>
</ChatMessageActions>
```

Additional exported parts: `ChatMessageActions.Root`.

## Examples

### Minimal

::example{id=chat-message-actions-minimal}

### Custom Icons

::example{id=chat-message-actions-custom-icons}

### Resumability

Buttons resume on first press; `Copy` uses `@rivetjs/cdk/clipboard` and writes its feedback as DOM attributes (no signal at load).

## Styling Reference

### CSS Classes

| Class                                               | Applied                                              |
| --------------------------------------------------- | ---------------------------------------------------- |
| `chat-message-actions`                              | root (`role=group`)                                  |
| `chat-message-actions__action`                      | every action button                                  |
| `chat-message-actions__copy-icon` / `__copied-icon` | Copy icons; `data-copied` on the button while copied |

## API Reference

See the [full module API](/api/rivetjs/ui/chat-message-actions/) for every named export and part prop type.

| Prop                   | Type                        | Default             |
| ---------------------- | --------------------------- | ------------------- |
| `aria-label` (root)    | `string`                    | `"Message actions"` |
| `text` (`Copy`)        | `string \| () => string`    | required            |
| `copiedLabel` (`Copy`) | `string`                    | `"Copied"`          |
| `onCopy` (`Copy`)      | `(copied: boolean) => void` | —                   |
| `iconSize` (`Copy`)    | `number`                    | `16`                |

`Action` takes every [Button](/components/button/) prop (`variant` ghost, `size` sm, `isIconOnly` by default).

::api{symbol="@rivetjs/ui/chat-message-actions#ChatMessageCopyProps"}

## Accessibility

the row is a `group` (default name "Message actions"); give every icon-only `Action` an `aria-label`. `Copy` is named "Copy", then "Copied" while the check shows.

## Related Components

- [ChatMessage](/components/chat-message/)
- [Toolbar](/components/toolbar/)
