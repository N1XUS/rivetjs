# @rivetjs/cdk/chat
> **Keep this file current:** ALWAYS update this CLAUDE.md in the same change whenever code in this directory changes (APIs, layout, commands, invariants, gotchas).

Rivet-authored headless chat behaviour (no React Aria / Angular CDK counterpart; feature set inspired by HeroUI Pro's public AI component docs, independent implementation). Plain functions called from resumable handlers: nothing runs at load.

## Entry points
- `@rivetjs/cdk/chat` -> `index.tsx` (package `./*` export):
  - composer: `isSubmitKey(event, allowsNewlines = true)` (Enter; never IME composing / keyCode 229 / Alt; Shift+Enter = newline unless `allowsNewlines` false), `supportsFieldSizing()`, `autosizeTextArea(textarea, maxHeight?)` (fallback when CSS `field-sizing: content` is missing)
  - stick to bottom: `AT_BOTTOM_THRESHOLD` (24 px), `distanceFromBottom(el)` / `isAtBottom(el, threshold?)` / `scrollToBottom(el, behavior = "smooth")` (normal and `column-reverse` scrollers: negative scrollTop), `syncAtBottom(el)` (writes / removes `data-at-bottom="true"`), `conversationViewportOf(from)` (closest `[data-chat-viewport]`)
  - files: `dragHasFiles(event)`, `acceptsFile(file, accept?)` (extensions, exact MIME, `type/*`), `selectedFiles(list, accept?, multiple = true)`
  - streaming: `streamText(target: Signal<string>, source: AsyncIterable | ReadableStream<string | Uint8Array>, { signal, onChunk })` (one signal write per chunk, UTF-8 decode), `simulateStream(text, { interval = 30, wordsPerChunk = 1, jitter = 0, random = Math.random, signal })` (local-timer word chunks; joined chunks = text; `jitter` 0..1 varies chunk size and delay by ±jitter and pauses `1 + 3·jitter`× after a sentence end / newline: natural cadence)
  - smooth growth: `followHeight(el, active, { maxSpeed = 240, smoothing = 90 })` → disposer: while `active()`, pins `el`'s height (`overflow: clip`) and eases it toward the content height one rAF step per frame (exponential ease-out, time constant `smoothing` ms, each step ≤ `maxSpeed` px/s: no frame jumps > 4 px at 60 fps; shrinks too); MutationObserver wakes the loop, it sleeps when settled; after `active()` turns false it settles then releases height / overflow. Content height = the contents' Range box + last child's bottom margin + padding / border (NOT `scrollHeight`: under `overflow: clip` it stops at the pinned height). No-op under reduced motion / without MutationObserver

## Layout
- `index.tsx` whole module (`.tsx`: the `./*` export maps to `<name>/index.tsx`; closures of `.ts` modules never resume)
- tests: `tests/chat.test.ts` (happy-dom)
- consumers: `@rivetjs/ui` `prompt-input` (keys, autosize), `chat-conversation` (scroll sync / button), `chat-attachment` (drop / pick), `markdown` (`followHeight` while streaming); ui-docs `ai-*` / `markdown-streaming` examples (`simulateStream` with `jitter`)

## Invariants
- Stick-to-bottom itself is CSS (`flex-direction: column-reverse` scroller starts and stays at the bottom); these helpers only measure for the jump button.
- No network: `simulateStream` is a timer; real apps pass a `fetch` body to `streamText`.
- `followHeight` runs only in the browser (callers start it from a `clientEffect`, never at resume); a flex container's children need `flex-shrink: 0` or the pinned height squeezes them.
