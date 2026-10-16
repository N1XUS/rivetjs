---
title: ChatAttachment
description: "File chips for a prompt or a message (image / video preview or file icon, name, size, remove) and a file picker / drop target for the composer."
template: reference
status: experimental
related: [components/prompt-input, components/close-button]
---

`ChatAttachment` shows one file. `mediaType` (`image`, `video`, `audio`, `document`, `unknown`) is inferred from `mimeType` and the file name: images and videos with `src` render a media preview (`data-variant="media"`), the rest a file chip with an icon per kind (PDF, spreadsheet, archive, code, …), the name and a formatted size. `onRemove` (Rivet extra) adds the remove button. `ChatAttachmentGroup` lays chips out as a list; `ChatAttachmentInput` adds the hidden file input, a `Trigger` button and a `Dropzone`.

Accessibility: the group is a `group` named "Attachments"; the remove button is "Remove attachment"; the picker trigger is "Attach files". Dropping is a pointer shortcut for the same picker.

## Usage

```tsx
import { ChatAttachment, ChatAttachmentGroup, ChatAttachmentInput } from "@rivetjs/ui/chat-attachment";
```

::example{id=chat-attachment-basic}

## Anatomy

```tsx
<ChatAttachment name="report.pdf" size={482133} onRemove={() => remove()} />
<ChatAttachment name="photo.jpg" mimeType="image/jpeg" src={url}>
  <ChatAttachment.Preview />
  <ChatAttachment.Info>
    <ChatAttachment.Name />
    <ChatAttachment.Size />
  </ChatAttachment.Info>
  <ChatAttachment.Remove onPress={() => remove()} />
</ChatAttachment>
```

Helpers: `inferChatAttachmentFileKind(name, mimeType)` and `formatChatAttachmentSize(bytes)` ("482 KB").

## Composer

`ChatAttachmentInput.Dropzone` `render` puts the drop target attributes onto your own element (here `PromptInput.Shell`); `data-drop-target` styles the drag-over state. `onFilesSelected` gets the picked or dropped files after the `accept` filter. Revoke object URLs you create for previews when a file is removed or sent.

::example{id=chat-attachment-composer}

## Grouped

::example{id=chat-attachment-grouped}

## CSS Classes

| Class                                             | Applied                                                       |
| ------------------------------------------------- | ------------------------------------------------------------- |
| `chat-attachment`                                 | root; `data-variant` (`media` / `file`), `data-kind`          |
| `chat-attachment__preview` (+ `-image`, `-video`) | `Preview`                                                     |
| `chat-attachment__icon`                           | `Icon`; `data-kind`                                           |
| `chat-attachment__info` / `__name` / `__size`     | text                                                          |
| `chat-attachment__remove`                         | `Remove`                                                      |
| `chat-attachment-group`                           | `ChatAttachmentGroup`                                         |
| `chat-attachment-input` / `__dropzone`            | `ChatAttachmentInput` (display contents) / default `Dropzone` |

## API Reference

| Prop                                      | Type                      | Default  |
| ----------------------------------------- | ------------------------- | -------- |
| `name`                                    | `string`                  | —        |
| `size`                                    | `number` (bytes)          | —        |
| `mimeType`                                | `string`                  | —        |
| `mediaType`                               | `ChatAttachmentMediaType` | inferred |
| `src`                                     | `string`                  | —        |
| `onRemove`                                | `() => void`              | —        |
| `accept` (`ChatAttachmentInput`)          | `string`                  | —        |
| `multiple` (`ChatAttachmentInput`)        | `boolean`                 | `true`   |
| `disabled` (`ChatAttachmentInput`)        | `boolean`                 | `false`  |
| `onFilesSelected` (`ChatAttachmentInput`) | `(files: File[]) => void` | —        |
| `render` (`Dropzone`)                     | `(attrs) => JSX.Element`  | a `div`  |

::api{symbol="@rivetjs/ui/chat-attachment#ChatAttachmentRootProps"}

::api{symbol="@rivetjs/ui/chat-attachment#ChatAttachmentInputRootProps"}

## Resumability

Chips are static markup; remove, pick and drop handlers resume on first use.
