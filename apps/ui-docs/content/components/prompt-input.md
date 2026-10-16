---
title: PromptInput
description: "The chat composer: autosizing textarea, toolbar, Send / Stop, run states, attachments and a prompt queue."
template: reference
status: experimental
related: [components/chat-attachment, components/prompt-suggestion, components/text-area]
---

`PromptInput` is the box where users write prompts. The textarea grows with its text up to `maxHeight` (CSS `field-sizing: content`, with a script fallback); Enter sends, Shift+Enter adds a line, IME composition never sends. `status` (`ready`, `submitted`, `streaming`, `error`) turns Send into Stop and, with `lockInputOnRun`, locks the textarea while a response runs.

Accessibility: the textarea is named by its placeholder unless you pass `aria-label`; Send is "Send message" and "Stop generating" while running, disabled while there is no text; toolbar `Action`s are icon buttons with optional tooltips.

## Usage

```tsx
import { PromptInput } from "@rivetjs/ui/prompt-input";
```

::example{id=prompt-input-basic}

## Anatomy

```tsx
<PromptInput status={() => status()} onSubmit={(text) => send(text)} onStop={() => stop()}>
  <PromptInput.Queue>…</PromptInput.Queue>
  <PromptInput.Shell>
    <PromptInput.Attachments>…</PromptInput.Attachments>
    <PromptInput.Content>
      <PromptInput.TextArea />
    </PromptInput.Content>
    <PromptInput.Toolbar>
      <PromptInput.ToolbarStart>
        <PromptInput.Action aria-label="Add" tooltip="Add">
          …
        </PromptInput.Action>
      </PromptInput.ToolbarStart>
      <PromptInput.ToolbarEnd>
        <PromptInput.Send />
      </PromptInput.ToolbarEnd>
    </PromptInput.Toolbar>
  </PromptInput.Shell>
  <PromptInput.Footer>…</PromptInput.Footer>
</PromptInput>
```

Uncontrolled composers clear after `onSubmit`; controlled ones (`value`) leave clearing to you.

## Secondary

::example{id=prompt-input-secondary}

## Inline

::example{id=prompt-input-inline}

## Compact

A one-line pill that expands into the stacked layout when the text wraps or attachments show (`data-expanded`).

::example{id=prompt-input-compact}

## With Suggestions

`value` takes a Signal for two-way binding; suggestion buttons write it.

::example{id=prompt-input-with-suggestions}

## Run State

::example{id=prompt-input-run-state}

## Queue

`PromptInput.Queue` lists prompts sent while a response runs; rows compose `Icon`, `Body`, `Content`, `Description`, `Attachments`, `AttachmentsOverflow`, `Actions`, `Remove`, `More`. Drag reordering is not implemented yet: `Handle` is visual only.

::example{id=prompt-input-queue}

## With Attachments

Wrap the shell in [ChatAttachmentInput](/components/chat-attachment/): the shell becomes the drop target and picked files render in `Attachments`.

::example{id=chat-attachment-composer}

## Token Input

A token input (tokens, suggestions, mentions) is not implemented yet.

## CSS Classes

| Class                                                                                                                                                                               | Applied                                                                                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `prompt-input`                                                                                                                                                                      | root; `data-layout`, `data-size`, `data-variant`, `data-status`, `data-disabled`, `data-expanded` |
| `prompt-input__shell`                                                                                                                                                               | `Shell` (drop target with ChatAttachmentInput; `data-drop-target`)                                |
| `prompt-input__content` / `__textarea`                                                                                                                                              | text area                                                                                         |
| `prompt-input__attachments`                                                                                                                                                         | `Attachments`                                                                                     |
| `prompt-input__toolbar` / `-start` / `-end`                                                                                                                                         | toolbar                                                                                           |
| `prompt-input__action`                                                                                                                                                              | `Action`                                                                                          |
| `prompt-input__send` / `__send-icon`                                                                                                                                                | `Send`; icon per `data-status`                                                                    |
| `prompt-input__footer`                                                                                                                                                              | `Footer`                                                                                          |
| `prompt-input__queue` / `__queue-list` / `__queue-item` (+ `-handle`, `-icon`, `-body`, `-content`, `-description`, `-attachments`, `-attachments-overflow`, `-actions`, `-action`) | queue                                                                                             |

| CSS variable                | Default  | What                                |
| --------------------------- | -------- | ----------------------------------- |
| `--prompt-input-max-height` | `240px`  | textarea growth limit (`maxHeight`) |
| `--prompt-input-radius`     | per size | shell radius                        |
| `--prompt-input-padding`    | per size | shell padding                       |
| `--prompt-input-text`       | per size | font size                           |

## API Reference

| Prop                                                      | Type                                                          | Default                     |
| --------------------------------------------------------- | ------------------------------------------------------------- | --------------------------- |
| `value` / `defaultValue` / `onValueChange`                | `string \| Signal \| () => string` / `string` / `(v) => void` | uncontrolled `""`           |
| `onSubmit`                                                | `(value: string) => void`                                     | —                           |
| `onStop`                                                  | `() => void`                                                  | —                           |
| `status`                                                  | `PromptInputStatus \| () => PromptInputStatus`                | `"ready"`                   |
| `isDisabled`                                              | `boolean \| () => boolean`                                    | `false`                     |
| `lockInputOnRun`                                          | `boolean`                                                     | `true`                      |
| `maxHeight`                                               | `number \| string`                                            | `240`                       |
| `size`                                                    | `"sm" \| "md" \| "lg"`                                        | `"md"`                      |
| `variant`                                                 | `"primary" \| "secondary"`                                    | `"primary"`                 |
| `layout`                                                  | `"stacked" \| "compact" \| "inline"`                          | `"stacked"`                 |
| `disableAutosize` / `allowsNewlines` (`TextArea`)         | `boolean`                                                     | `false` / `true`            |
| `placeholder` (`TextArea`)                                | `string`                                                      | "What do you want to know?" |
| `tooltip` (`Action`)                                      | `Content`                                                     | —                           |
| `stopLabel` (`Send`)                                      | `string`                                                      | "Stop generating"           |
| `actionsVisibility` (`Queue`)                             | `"always" \| "hover"`                                         | `"hover"`                   |
| `hiddenCount` / `noun` (`Queue.Item.AttachmentsOverflow`) | `number` / `string`                                           | — / "files"                 |

::api{symbol="@rivetjs/ui/prompt-input#PromptInputRootProps"}

::api{symbol="@rivetjs/ui/prompt-input#PromptInputTextAreaProps"}

## Resumability

Server-rendered; typing, Enter and Send resume on first input. Autosizing is CSS where `field-sizing` is supported, so nothing measures at load.
