---
title: ChatConversation
description: "The scrolling message log of a chat: starts at the newest message, stays there while answers stream, and offers a jump back to the bottom."
template: reference
status: experimental
related: [components/chat-message, components/prompt-input, components/scroll-shadow]
---

`ChatConversation` is the scroll container of a thread. It is a `column-reverse` scroller, so the browser itself starts at the bottom and keeps it pinned while content grows: no scroll script runs at load or while tokens stream. With `scrollButton`, `data-at-bottom` goes away when the user scrolls up and `ScrollButton` appears; without it the root has no scroll handler and a conversation is static markup.

Accessibility: the root is a focusable `role="log"` (default name "Conversation"), so new messages are announced politely and keyboard users can scroll it; `isStreaming` sets `aria-busy`. The scroll button is named "Scroll to bottom".

## Usage

```tsx
import { ChatConversation } from "@rivetjs/ui/chat-conversation";
```

::example{id=chat-conversation-basic}

## Anatomy

```tsx
<ChatConversation isStreaming={() => streaming()} scrollButton>
  <ChatConversation.Content>…messages…</ChatConversation.Content>
  <ChatConversation.ScrollButton />
</ChatConversation>
```

`ScrollAnchor` is an optional zero-height marker at the end of the content (e.g. for your own `scrollIntoView`).

## Full Chat

Every AI component together: a keyed `For` thread of [ChatMessage](/components/chat-message/) turns with [Markdown](/components/markdown/) answers, a [ChatLoader](/components/chat-loader/) until the first word, [ChatMessageActions](/components/chat-message-actions/), [PromptSuggestion](/components/prompt-suggestion/) pills and a [PromptInput](/components/prompt-input/) with Stop. Answers are canned and stream from a local timer (`simulateStream` from `@rivetjs/cdk/chat`): no network calls.

::example{id=ai-chat}

## Scroll Button

::example{id=chat-conversation-scroll-button}

## CSS Classes

| Class                                                            | Applied                                                               |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `chat-conversation`                                              | root scroller (`role=log`); `data-at-bottom`, `data-chat-viewport`    |
| `chat-conversation__stack`                                       | inner column (keeps the reversed scroller's content in reading order) |
| `chat-conversation__content`                                     | `Content`                                                             |
| `chat-conversation__scroll-anchor`                               | `ScrollAnchor`                                                        |
| `chat-conversation__scroll-button-container` / `__scroll-button` | `ScrollButton` (sticky)                                               |

| CSS variable                    | Default | What                 |
| ------------------------------- | ------- | -------------------- |
| `--chat-conversation-max-width` | `48rem` | content column width |

## API Reference

| Prop                          | Type                       | Default              |
| ----------------------------- | -------------------------- | -------------------- |
| `aria-label`                  | `string`                   | `"Conversation"`     |
| `isStreaming`                 | `boolean \| () => boolean` | `false`              |
| `scrollButton`                | `boolean`                  | `false`              |
| `aria-label` (`ScrollButton`) | `string`                   | `"Scroll to bottom"` |
| `behavior` (`ScrollButton`)   | `ScrollBehavior`           | `"smooth"`           |

Other `div` attributes pass to the root; `ScrollButton` takes the [Button](/components/button/) props.

::api{symbol="@rivetjs/ui/chat-conversation#ChatConversationRootProps"}

::api{symbol="@rivetjs/ui/chat-conversation#ChatConversationScrollButtonProps"}

## Resumability

Pinning is CSS. Without `scrollButton` the root has no handler: a conversation without the button ships no JS at all. With it, the scroll handler (button visibility) resumes on the first user scroll; a resumed chat page runs no code until the user interacts.
