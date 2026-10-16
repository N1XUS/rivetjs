---
title: ChatMessage
description: "Layouts for one chat turn: an assistant turn with avatar, body and actions, or a user bubble."
template: reference
status: experimental
related: [components/chat-conversation, components/chat-message-actions, components/markdown]
---

`ChatMessage` lays out a single turn. `ChatMessage.Assistant` is a full-width row with an avatar column and a body; `ChatMessage.User` is a right-aligned bubble. The body takes any content: plain text in `Content`, a [Markdown](/components/markdown/) answer, tools, sources, loaders, and an `Actions` row.

Accessibility: turns are plain `div`s with `data-role` (`assistant` / `user`) inside the conversation `log`; `Avatar` without `src` is decorative. Put a visually hidden sender name in `Meta` if the conversation needs one.

## Usage

```tsx
import { ChatMessage } from "@rivetjs/ui/chat-message";
```

::example{id=chat-message-basic}

## Anatomy

```tsx
<ChatMessage.Assistant>
  <ChatMessage.Avatar fallback="AI" />
  <ChatMessage.Body>
    <ChatMessage.Content>Answer</ChatMessage.Content>
    <ChatMessage.Actions>…</ChatMessage.Actions>
  </ChatMessage.Body>
</ChatMessage.Assistant>
<ChatMessage.User>
  <ChatMessage.Bubble>Question</ChatMessage.Bubble>
</ChatMessage.User>
```

`actionsVisibility` sets when the `Actions` row shows: `"always"` (assistant default) or `"hover"` (user default: pointer over or focus within the turn). `isStreaming` on `Assistant` (value or accessor) hides the `Actions` row while the reply streams and fades it in when it ends. `Avatar` with `src` is the ui [Avatar](/components/avatar/); without it the fallback renders as static markup.

## With Markdown

::example{id=chat-message-with-markdown}

## Loading

Render a [ChatLoader](/components/chat-loader/) in the body until the first token arrives.

::example{id=chat-message-loading}

## CSS Classes

| Class                                | Applied                                                                       |
| ------------------------------------ | ----------------------------------------------------------------------------- |
| `chat-message`                       | turn root; `data-role`, `data-actions` (`always` / `hover`), `data-streaming` |
| `chat-message--assistant` / `--user` | role                                                                          |
| `chat-message__avatar`               | `Avatar`                                                                      |
| `chat-message__body`                 | `Body`                                                                        |
| `chat-message__bubble`               | `Bubble`                                                                      |
| `chat-message__content`              | `Content`                                                                     |
| `chat-message__actions`              | `Actions`                                                                     |
| `chat-message__meta`                 | `Meta`                                                                        |

| CSS variable                      | Default           | What              |
| --------------------------------- | ----------------- | ----------------- |
| `--chat-message-bubble-max-width` | `min(80%, 36rem)` | user bubble width |

## API Reference

| Prop                                       | Type                       | Default                          |
| ------------------------------------------ | -------------------------- | -------------------------------- |
| `actionsVisibility` (`Assistant` / `User`) | `"always" \| "hover"`      | assistant `always`, user `hover` |
| `isStreaming` (`Assistant`)                | `boolean \| () => boolean` | `false`                          |
| `fallback` (`Avatar`)                      | `Content`                  | —                                |
| `src` / `alt` (`Avatar`)                   | `string`                   | —                                |
| `show` (`Avatar`)                          | `boolean`                  | `true`                           |

Every part takes `class` and `div` attributes.

::api{symbol="@rivetjs/ui/chat-message#ChatMessageRootProps"}

::api{symbol="@rivetjs/ui/chat-message#ChatMessageAvatarProps"}

## Resumability

Static layout; nothing runs at load. An `Avatar` with `src` uses the ui Avatar (image load tracking), which boots its small load effect.
