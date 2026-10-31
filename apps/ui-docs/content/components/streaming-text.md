---
title: StreamingText
description: "Smooth letter-by-letter text from bursty streams, with natural wrapping and a subtle fade."
template: reference
status: experimental
related: [components/markdown, components/chain-of-thought, components/text-shimmer]
---

`StreamingText` reveals appended text one visible character at a time. Incoming network chunks can contain partial words or several words: a frame queue smooths their arrival, and new letters fade in without sliding or expanding a container. Text remains inline and wraps naturally. Emoji and combining marks are kept together.

## Usage

```tsx
import { StreamingText } from "@rivetjs/ui/streaming-text";

<StreamingText content={() => text()} isStreaming={() => streaming()} />;
```

::example{id=streaming-text-basic}

Fill the source signal with `streamText(text, response.body)` from `@rivetjs/cdk/chat`. Initial content renders in full; subsequent appends are paced while `isStreaming`. When input ends, queued letters finish revealing. Replacing or clearing the source discards the previous queue.

## Pacing

`speed` defaults to 80 visible characters per second. Large bursts accelerate to catch up within 240ms. Set `speed={0}` for immediate updates. A hidden tab catches up on its next frame; no frames run when the queue is empty. Unmounting cancels the queue.

For formatted model answers, [Markdown](/components/markdown/) uses the same pacing automatically and exposes `streamingSpeed`.

## API Reference

| Prop          | Type                       | Default  |
| ------------- | -------------------------- | -------- |
| `content`     | `string \| () => string`   | required |
| `isStreaming` | `boolean \| () => boolean` | `false`  |
| `speed`       | `number`                   | `80`     |
| `class`       | `string`                   | —        |

Other `span` attributes pass to the root. Also exported: `StreamingText.Root`, `StreamingTextRoot`, `streamingTextVariants`.

::api{symbol="@rivetjs/ui/streaming-text#StreamingTextProps"}

## Styling Reference

| Class                       | Applied                                                           |
| --------------------------- | ----------------------------------------------------------------- |
| `streaming-text`            | root; `data-slot="streaming-text"`, `data-revealing` while queued |
| `streaming-text__character` | one visible character; `data-new` on appended characters          |

## Accessibility and server rendering

Server output contains the complete initial text. No timer or component code boots at rest; a source update wakes the component. There is one copy of the text and no per-letter live-region announcement. Put announcements at the message or conversation level. Reduced motion displays updates immediately and disables character fades.
