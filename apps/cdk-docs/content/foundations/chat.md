---
title: Chat helpers
description: Composer keyboard handling, file selection, conversation scrolling and streaming text helpers from @rivetjs/cdk/chat.
template: guide
status: experimental
related: [foundations/markdown, foundations/highlight, components/text-area, components/drop-zone]
---

`@rivetjs/cdk/chat` provides the behavior for a message composer, a conversation viewport and streaming text. You supply the markup and styling.

## Import and example

```tsx check
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/cdk/button";
import { simulateStream, streamText } from "@rivetjs/cdk/chat";

export function StreamingReply() {
  const reply = signal("");
  const pending = signal(false);
  return (
    <>
      <Button isPending={pending} onPress={async () => {
        reply.set("");
        pending.set(true);
        try {
          await streamText(reply, simulateStream("Your report is ready."));
        } finally {
          pending.set(false);
        }
      }}>Show reply</Button>
      <p>{reply()}</p>
    </>
  );
}
```

`simulateStream` uses a local timer. For real responses, pass an async iterable or a `ReadableStream` of strings or UTF-8 byte chunks to `streamText`. It appends to the existing signal value; clear the signal yourself when starting a new response.

## API

| Export | Signature / default | Behavior |
| --- | --- | --- |
| `isSubmitKey` | `(event: KeyboardEvent, allowsNewlines = true) => boolean` | Enter submits; Shift+Enter submits only when newlines are disabled. IME composition, key code 229 and Alt+Enter never submit. Does not prevent the event itself. |
| `supportsFieldSizing` | `() => boolean` | Cached check for CSS `field-sizing: content`; call in the browser. |
| `autosizeTextArea` | `(textarea, maxHeight?) => void` | Input-handler fallback when native field sizing is unavailable; defaults to the element's CSS max-height. |
| `AT_BOTTOM_THRESHOLD` | `24` | Default distance in pixels for the bottom check. |
| `distanceFromBottom` | `(element) => number` | Remaining scroll distance, including `column-reverse` containers. |
| `isAtBottom` | `(element, threshold = 24) => boolean` | Whether the remaining distance is at most the threshold. |
| `scrollToBottom` | `(element, behavior = "smooth") => void` | Scrolls to the end. Pass `"auto"` when animated scrolling is inappropriate. |
| `syncAtBottom` | `(element, threshold = 24) => boolean` | Sets `data-at-bottom="true"` or removes it and returns the result. Call from `onScroll`. |
| `conversationViewportOf` | `(element: Element \| null) => HTMLElement \| null` | Finds the closest `[data-chat-viewport]` element. |
| `dragHasFiles` | `(event: DragEvent) => boolean` | Checks for `"Files"` in `dataTransfer.types`. |
| `acceptsFile` | `(file: { name; type }, accept?) => boolean` | Matches extensions, MIME types or `type/*`; an omitted or empty filter accepts all files. |
| `selectedFiles` | `(list, accept?, multiple = true) => File[]` | Filters a FileList or file array; with `multiple=false`, returns at most one matching file. |
| `streamText` | `(target, source, options?) => Promise<string>` | Appends chunks, updates the signal, and resolves with its accumulated text. |
| `simulateStream` | `(text, options?) => AsyncGenerator<string>` | Yields word-sized chunks, preserving whitespace. |
| `followHeight` | `(element, active: () => boolean, options?) => () => void` | Eases the element's height while active, then releases it after settling. Returns cleanup; start it in a client effect. |

### Options

| Type | Options and defaults |
| --- | --- |
| `StreamTextOptions` | `signal?: AbortSignal`; `onChunk?: (text, chunk) => void`, called after an appended chunk. Aborting stops reading and resolves with the text so far. |
| `SimulatedStreamOptions` | `interval = 30` ms, `wordsPerChunk = 1`, `jitter = 0` (clamped to 0–1), `random = Math.random`, `signal?: AbortSignal`. Jitter varies delay and chunk size and adds pauses after sentences. |
| `FollowHeightOptions` | `maxSpeed = 240` px/s; `smoothing = 90` ms. No-op with reduced motion or without MutationObserver/requestAnimationFrame. |

## Anatomy and styling

These helpers render no elements and assign no `rv-*` classes. Put `data-chat-viewport` on your scroll container if you use `conversationViewportOf`; `syncAtBottom` writes its `data-at-bottom` state. `followHeight` temporarily sets inline `height` and `overflow: clip`, then clears them. Return its disposer from your client effect.

## Keyboard and accessibility

Label the composer textarea and provide a submit button. In its key handler, call `preventDefault()` only when `isSubmitKey(event)` is true and you actually submit. Keep Shift+Enter available for multiline messages and let composition finish before submitting.

Scrolling helpers do not move focus or announce messages. Keep those choices in the conversation UI; avoid making a live region announce every streamed token. File filters only select files; they do not supply a keyboard file picker. Use [FileTrigger](../components/file-trigger.md) alongside a drop target.
