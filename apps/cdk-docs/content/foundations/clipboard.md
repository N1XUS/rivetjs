---
title: Clipboard
description: Copy text with @rivetjs/cdk/clipboard - async copy(), synchronous copyText and beginCopy, and the Angular CDK copy-to-clipboard behaviour with retries.
template: guide
status: experimental
related: [foundations/utilities, foundations/announcements, foundations/platform]
---

`@rivetjs/cdk/clipboard` writes text to the clipboard. `copy(text)` uses `navigator.clipboard.writeText` and falls back to a hidden `<textarea>` plus `execCommand("copy")` where that API is missing or refused (insecure origins, some frames). It also supports synchronous copies, pending copies for large strings, and retries with `copyToClipboard`.

::example{id=clipboard-copy}

## Import

```ts
import { copy, copyText, beginCopy, PendingCopy, copyToClipboard, destroyCopyToClipboard, type CopyToClipboardOptions } from "@rivetjs/cdk/clipboard";
```

## API

| Export | Signature | Does |
| --- | --- | --- |
| `copy` | `(text: string) => Promise<boolean>` | Async Clipboard API first, then `copyText`. Resolves `true` when the clipboard accepted the text. |
| `copyText` | `(text: string, doc?: Document) => boolean` | Angular `Clipboard.copy`: hidden textarea + `execCommand("copy")`, synchronous. Focus returns to the element focused before. |
| `beginCopy` | `(text: string, doc?: Document) => PendingCopy` | Angular `Clipboard.beginCopy`: inserts the hidden textarea now, so `copy()` can run in a later tick. The caller must `destroy()` it. |
| `PendingCopy` | class: `copy(): boolean`, `destroy(): void` | A prepared copy. `copy()` may be called several times; `destroy()` removes the textarea. |
| `copyToClipboard` | `(owner: object, options: CopyToClipboardOptions) => void` | The `[cdkCopyToClipboard]` click behaviour: copies, retries up to `attempts` times 1 ms apart, then calls `copied(successful)` once. `owner` identifies the trigger (usually `event.currentTarget`). |
| `destroyCopyToClipboard` | `(owner: object) => void` | Directive destroy: stops retrying and destroys pending copies started for `owner`. |

`CopyToClipboardOptions`:

| Option | Type | Default | Notes |
| --- | --- | --- | --- |
| `text` | `string` | required | Content to copy. |
| `attempts` | `number` | `1` | Tries before giving up; capped at 50. Long text may need time to fill the textarea. |
| `copied` | `(successful: boolean) => void` | none | Angular `(cdkCopyToClipboardCopied)`: called once with the result. |

The hidden textarea is `position: fixed` at the top, `opacity: 0`, `aria-hidden="true"` and `readonly` (no page jump on iOS Safari). In fullscreen mode it goes inside the fullscreen element, or the browser refuses the copy.

## Retries and results

`copyToClipboard` keeps its pending copies and retry timer in a `WeakMap` keyed by the owner element, never in component state, so nothing unserializable ends up in a resumed page. Pass the `copied` callback inline in the handler:

::example{id=clipboard-attempts}

## Large text

`copyText` creates the textarea, selects it and copies in one go. For a very large string the re-layout can take long enough that the browser refuses `execCommand("copy")`. `beginCopy` splits the two steps:

::example{id=clipboard-pending}

```ts
const pending = beginCopy(rows);
let ok = pending.copy();
if (!ok) ok = await new Promise((resolve) => setTimeout(() => resolve(pending.copy()), 1));
pending.destroy();
```

## Accessibility

- Call the functions from a click or key handler: browsers allow clipboard writes only after a user gesture.
- Report the result in a `role="status"` element (or with [`announce()`](announcements.md)), so screen readers hear it too.
- In an `<iframe>`, the frame needs `allow="clipboard-write"` for the async Clipboard API; the fallback still works there.

## Resumability

The functions are plain module functions: a handler calls them without capturing a service object, so the handler resumes. Nothing runs at import time or on the server (they touch `document` / `navigator` only when called).

## Upstream

Ports `Clipboard.copy` (→ `copyText`), `Clipboard.beginCopy`, `PendingCopy` and the `CdkCopyToClipboard` directive (→ `copyToClipboard` + `destroyCopyToClipboard`) from Angular CDK `cdk/clipboard`. Rivet adds the async `copy()`. Not ported: the `CDK_COPY_TO_CLIPBOARD_CONFIG` injection token (pass `attempts` per call).

## Common mistakes

- **Copying on page load.** Without a user gesture the browser refuses, and `copy()` resolves to `false`.
- **Forgetting `destroy()`.** A `PendingCopy` leaves its textarea in the document until destroyed.
- **Silent results.** A visual "Copied" alone is not announced. Use a status region.
