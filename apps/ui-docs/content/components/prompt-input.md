---
title: PromptInput
description: "The chat composer: autosizing textarea, toolbar, Send / Stop, run states, attachments, a prompt queue and a token input for @mentions and /commands."
template: reference
status: experimental
related: [components/chat-attachment, components/prompt-suggestion, components/text-area]
---

`PromptInput` is the box where users write prompts. The textarea grows with its text up to `maxHeight` (CSS `field-sizing: content`, with a script fallback); Enter sends, Shift+Enter adds a line, IME composition never sends. `status` (`ready`, `submitted`, `streaming`, `error`) turns Send into Stop and, with `lockInputOnRun`, locks the textarea while a response runs.

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

With tokens, `PromptInputTokens` wraps the token field and its suggestions in place of `PromptInput.TextArea`. The token parts live in their own subpath `@rivetjs/ui/prompt-input-tokens` (not `PromptInput.*` parts), so a composer without tokens ships none of their code:

```tsx
import { PromptInput } from "@rivetjs/ui/prompt-input";
import {
  PromptInputTokenInput,
  PromptInputTokens,
  PromptInputTokenSuggestion,
  PromptInputTokenSuggestions,
  usePromptInputTokens,
} from "@rivetjs/ui/prompt-input-tokens";

const tokens = usePromptInputTokens({ triggers: ["@"] });

<PromptInput onSubmit={(text) => send(text)}>
  <PromptInput.Shell>
    <PromptInputTokens tokens={tokens}>
      <PromptInput.Content>
        <PromptInputTokenInput />
      </PromptInput.Content>
      <PromptInputTokenSuggestions>
        <PromptInputTokenSuggestion id="ana" token="@ana">
          Ana Lima
        </PromptInputTokenSuggestion>
      </PromptInputTokenSuggestions>
    </PromptInputTokens>
    <PromptInput.Toolbar>…</PromptInput.Toolbar>
  </PromptInput.Shell>
</PromptInput>;
```

Additional exported parts: `PromptInput.Root`.

## Examples

### Secondary

::example{id=prompt-input-secondary}

### Inline

::example{id=prompt-input-inline}

### Compact

A one-line pill that expands into the stacked layout when the text wraps or attachments show (`data-expanded`).

::example{id=prompt-input-compact}

### Review Composer

Compose the toolbar with workflow controls for compact agent surfaces: a review follow-up with the pull request, a commit option and an Approve action next to Send.

::example{id=prompt-input-review-composer}

### With Suggestions

`value` takes a Signal for two-way binding; suggestion buttons write it.

::example{id=prompt-input-with-suggestions}

### Run State

::example{id=prompt-input-run-state}

### Queue

`PromptInput.Queue` lists prompts sent while a response runs; rows compose `Icon`, `Body`, `Content`, `Description`, `Attachments`, `AttachmentsOverflow`, `Actions`, `Remove`, `More`. Drag reordering is not implemented yet: `Handle` is visual only.

::example{id=prompt-input-queue}

### With Attachments

Wrap the shell in [ChatAttachmentInput](/components/chat-attachment/): the shell becomes the drop target and picked files render in `Attachments`.

::example{id=chat-attachment-composer}

### Token Input

`PromptInputTokenInput` replaces `TextArea` for prompts with inline tokens such as `@mentions` or `/commands`. It is still a native `<textarea>` (no `contenteditable`): the value is a list of segments (`{ type: "text", text }` and `{ type: "token", text, value?, trigger? }`) whose joined text is exactly the field's text, and a layer behind the textarea draws the same text with the token pills. Tokens are atomic: Backspace or Delete next to one removes it whole, the arrow keys step over it, and an edit that touches one (cut, word delete, typing over a selection) removes it.

`usePromptInputTokens` holds the state; wrap the field and `PromptInputTokenSuggestions` in `PromptInputTokens` so the arrow keys and Enter drive the suggestions while the caret stays in the field. Typing a trigger at a word boundary opens them; `tokens.query()` is the text typed after it (it ends at the first space unless `allowsSpaces`) — filter your options with it. A `PromptInputTokenSuggestion` inserts its `token` text (its `id` becomes the token's `value`), or calls `onAction`, where `tokens.insertToken(text, { value })` does the same. Escape dismisses the suggestions for the current trigger until the caret leaves it; a blur, `tokens.close()` or picking an option hides them until the next edit or caret move. The panel sits at the trigger and hides itself while it has no options.

Leave `value` unset on `PromptInput`: the token field owns the prompt and hands Send and `onSubmit` its text; an uncontrolled composer clears the tokens after submitting, otherwise call `tokens.setValue([])`. Keep the toolbar and other menus outside `PromptInputTokens`.

::example{id=prompt-input-token-input}

Several triggers share one panel: render the options for `tokens.trigger()`. A composer docked at the bottom of the viewport opens the panel upward with `placement="top start"`.

::example{id=prompt-input-token-commands}

The segments are data: pass a Signal as `value` for two-way binding (or `defaultValue` / `onChange`), read the token `value`s back, replace them with `tokens.setValue`.

::example{id=prompt-input-token-value}

### Resumability

Server-rendered; typing, Enter and Send resume on first input. Autosizing is CSS where `field-sizing` is supported, so nothing measures at load. A token input renders its tokens on the server too (segments are plain data); its handlers resume on the first keystroke, focus or click, and the caret is measured only while the suggestions are open.

## Styling Reference

The component’s parts emit these additional `data-slot` values: `prompt-input-footer`, `prompt-input-textarea`, `prompt-input-token-field`, `prompt-input-token-mirror`, `prompt-input-token-input`, `prompt-input-token-suggestions`, `prompt-input-token-suggestion`, `prompt-input-action`, `prompt-input-send`, `prompt-input-queue-list`, `prompt-input-queue-item`, `prompt-input-queue-item-handle`, `prompt-input-queue-item-icon`, `prompt-input-queue-item-attachments-overflow`, `prompt-input-queue-item-action`.

### CSS Classes

| Class                                                                                                                                                                               | Applied                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `prompt-input`                                                                                                                                                                      | root; `data-layout`, `data-size`, `data-variant`, `data-status`, `data-disabled`, `data-expanded`             |
| `prompt-input__shell`                                                                                                                                                               | `Shell` (drop target with ChatAttachmentInput; `data-drop-target`)                                            |
| `prompt-input__content` / `__textarea`                                                                                                                                              | text area                                                                                                     |
| `prompt-input__attachments`                                                                                                                                                         | `Attachments`                                                                                                 |
| `prompt-input__toolbar` / `-start` / `-end`                                                                                                                                         | toolbar                                                                                                       |
| `prompt-input__action`                                                                                                                                                              | `Action`                                                                                                      |
| `prompt-input__send` / `__send-icon`                                                                                                                                                | `Send`; icon per `data-status`                                                                                |
| `prompt-input__footer`                                                                                                                                                              | `Footer`                                                                                                      |
| `prompt-input__token-field` / `__token-mirror` / `__token-input`                                                                                                                    | `PromptInputTokenInput`: wrapper, the layer drawing text + pills, the textarea                                |
| `prompt-input__token`                                                                                                                                                               | token pill (`PromptInputToken`); `data-token` (trigger), `data-value`, `data-selected`, `data-disabled`       |
| `prompt-input__token-suggestions` / `__token-suggestion`                                                                                                                            | `PromptInputTokenSuggestions` (`data-open`, `data-placement`) / `PromptInputTokenSuggestion` (`data-focused`) |
| `prompt-input__queue` / `__queue-list` / `__queue-item` (+ `-handle`, `-icon`, `-body`, `-content`, `-description`, `-attachments`, `-attachments-overflow`, `-actions`, `-action`) | queue                                                                                                         |

| CSS variable                                  | Default        | What                                          |
| --------------------------------------------- | -------------- | --------------------------------------------- |
| `--prompt-input-max-height`                   | `240px`        | textarea growth limit (`maxHeight`)           |
| `--prompt-input-radius`                       | per size       | shell radius                                  |
| `--prompt-input-padding`                      | per size       | shell padding                                 |
| `--prompt-input-text`                         | per size       | font size                                     |
| `--prompt-input-token-x` / `-top` / `-bottom` | set while open | trigger box for `PromptInputTokenSuggestions` |

## API Reference

See the [full module API](/api/rivetjs/ui/prompt-input/) for every named export and part prop type.

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

Token input:

| API                                                                                      | Type                                                                                                                                                                   | Default                                                                        |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `usePromptInputTokens({ triggers, allowsSpaces, value, defaultValue, onChange })`        | `string[]`, `boolean`, `PromptTokenValue \| Signal \| () => PromptTokenValue`, `PromptTokenValue`, `(segments) => void`                                                | `["@", "/"]`, `false`, uncontrolled `[]`                                       |
| returns                                                                                  | `value()`, `setValue(segments)`, `text()`, `inputRef()`, `anchor()`, `query()`, `trigger()`, `isOpen()`, `insertToken(text, { appendSpace = true, value })`, `close()` | —                                                                              |
| `tokens` (`PromptInputTokenInput`, `PromptInputTokens`, `PromptInputTokenSuggestions`)   | token state                                                                                                                                                            | from `PromptInputTokens`                                                       |
| `placeholder` / `allowsNewlines` / `isReadOnly` / `isDisabled` (`PromptInputTokenInput`) | `string` / `boolean`                                                                                                                                                   | "What do you want to know?" / `true` / `false` / composer disabled or run lock |
| `children` (`PromptInputTokenInput`)                                                     | `(segment, index) => PromptInputToken`                                                                                                                                 | `PromptInputToken`                                                             |
| `isOpen` / `placement` (`PromptInputTokenSuggestions`)                                   | `boolean \| () => boolean` / `"bottom start" \| "bottom end" \| "top start" \| "top end"`                                                                              | `tokens.isOpen` / `"bottom start"`                                             |
| `id` / `token` / `textValue` / `onAction` / `isDisabled` (`PromptInputTokenSuggestion`)  | `string` / `string` / `string` / `() => void` / `boolean`                                                                                                              | — (`onAction` default inserts `token` with `value` = `id`)                     |

::api{symbol="@rivetjs/ui/prompt-input#PromptInputRootProps"}

::api{symbol="@rivetjs/ui/prompt-input#PromptInputTextAreaProps"}

## Accessibility

the textarea is named by its placeholder unless you pass `aria-label`; Send is "Send message" and "Stop generating" while running, disabled while there is no text; toolbar `Action`s are icon buttons with optional tooltips. The token input is a list autocomplete: the textarea keeps focus and points at the `role="listbox"` panel (`aria-controls`, `aria-autocomplete="list"`, `aria-activedescendant` = the highlighted `role="option"`); ↑ / ↓ move the highlight, Enter picks it, Escape closes the panel; tokens are plain text in the textarea, so screen readers read them as typed (`@ana`), and the pill layer is `aria-hidden`.

## Related Components

- [ChatAttachment](/components/chat-attachment/)
- [PromptSuggestion](/components/prompt-suggestion/)
- [TextArea](/components/text-area/)
