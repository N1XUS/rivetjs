---
title: ChatListView
description: "A conversation history list: threads with icon, title, preview and time; the open one is current."
template: reference
status: experimental
related: [components/sidebar, components/list-box]
---

`ChatListView` lists conversations for a sidebar or a history page. `Item` is a button, or a link with `href`; `isCurrent` (value or accessor) marks the open thread. `Section` labels groups ("Today", "Previous 7 days").

Accessibility: items are native buttons / links in tab order; the current one has `aria-current` (`true` for buttons, `page` for links).

## Usage

```tsx
import { ChatListView } from "@rivetjs/ui/chat-list-view";
```

::example{id=chat-list-view-basic}

## Anatomy

```tsx
<ChatListView aria-label="Chats">
  <ChatListView.Section>Today</ChatListView.Section>
  <ChatListView.Item href="/c/42" isCurrent>
    <ChatListView.Icon>…</ChatListView.Icon>
    <ChatListView.ItemContent>
      <ChatListView.Title>Trip plan</ChatListView.Title>
      <ChatListView.Preview>Here is a plan…</ChatListView.Preview>
    </ChatListView.ItemContent>
    <ChatListView.Meta>2m</ChatListView.Meta>
  </ChatListView.Item>
</ChatListView>
```

## Compact

`variant="compact"`: one line per thread, tighter padding.

::example{id=chat-list-view-compact}

## CSS Classes

| Class                                            | Applied                |
| ------------------------------------------------ | ---------------------- |
| `chat-list-view`                                 | root; `data-variant`   |
| `chat-list-view--compact`                        | compact variant        |
| `chat-list-view__item`                           | `Item`; `data-current` |
| `chat-list-view__icon`                           | `Icon`                 |
| `chat-list-view__item-content`                   | `ItemContent`          |
| `chat-list-view__title` / `__preview` / `__meta` | text parts             |
| `chat-list-view__section`                        | `Section`              |

## API Reference

| Prop                 | Type                       | Default     |
| -------------------- | -------------------------- | ----------- |
| `variant`            | `"default" \| "compact"`   | `"default"` |
| `isCurrent` (`Item`) | `boolean \| () => boolean` | `false`     |
| `href` (`Item`)      | `string`                   | — (button)  |
| `onPress` (`Item`)   | `(e) => void`              | —           |

`Item` takes the cdk Button / Link props; other parts take `class` and `div` attributes.

::api{symbol="@rivetjs/ui/chat-list-view#ChatListViewRootProps"}

## Resumability

Static list; items resume on first press. `isCurrent` accessors are attribute bindings.
