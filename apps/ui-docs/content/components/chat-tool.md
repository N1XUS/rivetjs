---
title: ChatTool
description: "A tool call in an agent answer: name and status in the trigger, input, result, error or an approval step in the content."
template: reference
status: experimental
related: [components/chain-of-thought, components/code-block, components/disclosure]
---

`ChatTool` shows one tool call. In preset mode (no children) it renders the trigger (status icon, `triggerPrefix`, `toolName`) and the content from `input` / `argsText`, `output`, `errorText` and the approval buttons, by `state`. Children switch to composable mode with the parts. It is a [Disclosure](/components/disclosure/); `ChatToolGroup` folds several calls under one trigger.

Accessibility: the status icon is an image with a text label ("Running", "Completed", "Failed", "Needs approval"); errors are `role="alert"`; a call that `requires-action` opens by default so the buttons are reachable.

## Usage

```tsx
import { ChatTool, ChatToolGroup } from "@rivetjs/ui/chat-tool";
```

::example{id=chat-tool-basic}

## Anatomy

```tsx
<ChatTool toolName="getForecast" state="output-available" input={args} output={result} />
<ChatTool state="output-error">
  <ChatTool.Trigger>
    <ChatTool.StatusIcon />
    Weather
  </ChatTool.Trigger>
  <ChatTool.Content>
    <ChatTool.Args input={args} />
    <ChatTool.Error>Timed out</ChatTool.Error>
  </ChatTool.Content>
</ChatTool>
```

States: `input-streaming`, `input-available` (default), `output-available`, `output-error`, `requires-action`. `ChatTool.Icon` (Rivet extra) is a lucide wrench for custom triggers.

## Streaming

`input-streaming` shows a spinner and the partial `argsText`; the state is read once, so re-create the tool per state (keyed `Show`).

::example{id=chat-tool-streaming}

## Error

::example{id=chat-tool-error}

## Approval

`requires-action` renders Reject / Approve (`onReject` / `onApprove`) and opens the tool.

::example{id=chat-tool-approval}

## Grouped

::example{id=chat-tool-grouped}

## Composable

::example{id=chat-tool-composable}

## CSS Classes

| Class                                                      | Applied                           |
| ---------------------------------------------------------- | --------------------------------- |
| `chat-tool`                                                | root (`disclosure`); `data-state` |
| `chat-tool__heading` / `__trigger` / `__indicator`         | trigger                           |
| `chat-tool__status-icon`                                   | status icon; `data-state`         |
| `chat-tool__trigger-label` / `__tool-name` / `__tool-icon` | trigger text and icon             |
| `chat-tool__body`                                          | content body                      |
| `chat-tool__args` / `__result` / `__code`                  | JSON blocks (`code-block`)        |
| `chat-tool__error` (+ `-icon`, `-text`)                    | error                             |
| `chat-tool__approval` (+ `-text`, `-actions`)              | approval                          |
| `chat-tool-group` / `__trigger` / `__body`                 | `ChatToolGroup`                   |

## API Reference

| Prop                                        | Type             | Default                       |
| ------------------------------------------- | ---------------- | ----------------------------- |
| `toolName`                                  | `string`         | —                             |
| `state`                                     | `ChatToolState`  | `"input-available"`           |
| `triggerPrefix`                             | `Content`        | —                             |
| `input` / `output`                          | `unknown` (JSON) | —                             |
| `argsText`                                  | `string`         | —                             |
| `errorText`                                 | `string`         | "The tool call failed."       |
| `onApprove` / `onReject`                    | `() => void`     | —                             |
| `defaultExpanded`                           | `boolean`        | `state === "requires-action"` |
| `label` (`Args` / `Result`)                 | `Content`        | "Input" / "Result"            |
| `approveLabel` / `rejectLabel` (`Approval`) | `Content`        | "Approve" / "Reject"          |

`ChatTool` and `ChatToolGroup` take the Disclosure props.

::api{symbol="@rivetjs/ui/chat-tool#ChatToolRootProps"}

::api{symbol="@rivetjs/ui/chat-tool#ChatToolApprovalProps"}

## Resumability

Server-rendered with highlighted JSON; the Disclosure resumes on first toggle, approval buttons on first press.
