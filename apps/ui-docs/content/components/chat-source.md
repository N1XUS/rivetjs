---
title: ChatSource
description: "Citation pills for the sources of an answer, with a hover preview and a collapsible source list."
template: reference
status: experimental
related: [components/chat-message, components/tooltip, components/disclosure]
---

`ChatSource` is an inline pill linking to a source: favicon (or the domain initial), title (default: the domain of `href`). A URL source shows a preview card on hover and focus (the ui [Tooltip](/components/tooltip/)): site, title (falls back to the URL) and the `description` when given. A source without `href` is a document (file icon, no link). `ChatSources` collects sources in a [Disclosure](/components/disclosure/).

Accessibility: a URL pill is a link (opens in a new tab with `rel="noopener noreferrer"`); the preview is a tooltip, so it never holds interactive content.

## Usage

```tsx
import { ChatSource, ChatSources } from "@rivetjs/ui/chat-source";
```

::example{id=chat-source-basic}

## Anatomy

```tsx
<ChatSource href={url} title="Docs" description="Preview text" faviconUrl={icon} />
<ChatSources>
  <ChatSources.Trigger>3 sources</ChatSources.Trigger>
  <ChatSources.Content>
    <ChatSources.List>…</ChatSources.List>
  </ChatSources.Content>
</ChatSources>
```

## Document

::example{id=chat-source-document}

## Grouped

::example{id=chat-source-grouped}

## Stacked Favicons

`ChatSources.Favicons` (Rivet extra) stacks up to `max` source icons in the trigger.

::example{id=chat-source-stacked-favicons}

## Composable

Children replace the preset pill: compose `Trigger`, `Icon`, `Title` and `Preview`; `enablePreview` turns the composed preview on.

::example{id=chat-source-composable}

## CSS Classes

| Class                                                                   | Applied                           |
| ----------------------------------------------------------------------- | --------------------------------- |
| `chat-source`                                                           | root; `data-source-type`          |
| `chat-source__trigger` / `__trigger-link`                               | pill                              |
| `chat-source__icon` / `__icon-fallback` / `__document-icon`             | favicon, initial, file icon       |
| `chat-source__title`                                                    | title                             |
| `chat-source__preview` (+ `-site`, `-domain`, `-title`, `-description`) | preview card                      |
| `chat-sources`                                                          | `ChatSources` root (`disclosure`) |
| `chat-sources__trigger` / `__indicator` / `__body` / `__list`           | group parts                       |
| `chat-sources__favicons` / `__favicon`                                  | `Favicons`                        |

## API Reference

| Prop                                       | Type                                          | Default                                                                   |
| ------------------------------------------ | --------------------------------------------- | ------------------------------------------------------------------------- |
| `href`                                     | `string`                                      | —                                                                         |
| `title`                                    | `string`                                      | domain of `href`                                                          |
| `description`                              | `string`                                      | —                                                                         |
| `enablePreview`                            | `boolean`                                     | preset: `true` for URL sources or with a `description`; composed: `false` |
| `faviconUrl`                               | `string`                                      | —                                                                         |
| `sourceType`                               | `"url" \| "document"`                         | `url` with `href`                                                         |
| `sources` / `max` (`ChatSources.Favicons`) | `{ href?, title?, faviconUrl? }[]` / `number` | — / `3`                                                                   |

`ChatSources` takes the Disclosure props (`defaultExpanded`, `isExpanded`, …).

::api{symbol="@rivetjs/ui/chat-source#ChatSourceRootProps"}

::api{symbol="@rivetjs/ui/chat-source#ChatSourcesFaviconsProps"}

## Resumability

Pills are links: nothing runs at load. The preview tooltip resumes on first hover or focus; the group on first toggle.
