// Clipboard.
// Ported from angular/components src/cdk/clipboard (MIT, © Google LLC): `Clipboard.copy` /
// `beginCopy` (→ `copyText`, `beginCopy`), `PendingCopy`, the `[cdkCopyToClipboard]` directive
// (→ `copyToClipboard(element, options)` handler body + `destroyCopyToClipboard`). Plus `copy()`:
// the async `navigator.clipboard.writeText` path with the same textarea fallback.
//
// Rivet: services become module functions (a handler can call them without capturing an
// unserializable service object); the directive's pending copies / retry timer live in a WeakMap
// keyed by the trigger element (transient, never serialized). Browser only; call from a user gesture.

/** Options of `[cdkCopyToClipboard]` (`CdkCopyToClipboardConfig` for the `attempts` default). */
export interface CopyToClipboardOptions {
  /** Content to be copied. */
  text: string;
  /**
   * How many times to attempt the copy (long text may need time to fill the intermediate textarea).
   * Capped at 50. Default 1.
   */
  attempts?: number;
  /** `(cdkCopyToClipboardCopied)`: called once with whether copying succeeded. */
  copied?: (successful: boolean) => void;
}

/**
 * A pending copy-to-clipboard operation. Copying modifies the DOM and forces a re-layout, which for a
 * large string can take long enough that the browser refuses `execCommand("copy")`: this object lets
 * the re-layout happen in a separate tick from copying. Call `destroy()` when done, whether or not
 * `copy()` was called.
 */
export class PendingCopy {
  private _textarea: HTMLTextAreaElement | undefined;
  private readonly _document: Document;

  constructor(text: string, _document: Document) {
    this._document = _document;
    const textarea = (this._textarea = _document.createElement("textarea"));
    const styles = textarea.style;
    // Hidden for display and accessibility; fixed at top 0 so focusing it for a split second never
    // scrolls the page.
    styles.position = "fixed";
    styles.top = styles.opacity = "0";
    styles.left = "-999em";
    textarea.setAttribute("aria-hidden", "true");
    textarea.value = text;
    // `readonly` prevents the screen from jumping on iOS Safari.
    textarea.readOnly = true;
    // In fullscreen mode the textarea must be inside the fullscreen element, or the copy is refused.
    (_document.fullscreenElement || _document.body).appendChild(textarea);
  }

  /** Finishes copying the text; returns whether it worked. Focus returns to the element focused before. */
  copy(): boolean {
    const textarea = this._textarea;
    let successful = false;
    try {
      // Older browsers could throw if copy is not supported.
      if (textarea) {
        const currentFocus = this._document.activeElement as (Element & HTMLOrSVGElement) | null;
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
        successful = this._document.execCommand("copy");
        if (currentFocus) currentFocus.focus();
      }
    } catch {
      // Discard: `successful` stays false.
    }
    return successful;
  }

  /** Cleans up the DOM changes used to perform the copy operation. */
  destroy(): void {
    const textarea = this._textarea;
    if (textarea) {
      textarea.remove();
      this._textarea = undefined;
    }
  }
}

const ownerDocument = (doc?: Document): Document => doc ?? document;

/** Prepares `text` to be copied later (large strings); the caller must `destroy()` the result. */
export function beginCopy(text: string, doc?: Document): PendingCopy {
  return new PendingCopy(text, ownerDocument(doc));
}

/** Angular `Clipboard.copy`: copies `text` synchronously (textarea + `execCommand`); returns whether it worked. */
export function copyText(text: string, doc?: Document): boolean {
  const pending = beginCopy(text, doc);
  const successful = pending.copy();
  pending.destroy();
  return successful;
}

/** The functions `copyToClipboard` uses (tests replace them, as the original spec spies on `Clipboard`). */
export const _clipboard = { copy: copyText, beginCopy };

interface DirectiveState {
  pending: Set<PendingCopy>;
  timeout: ReturnType<typeof setTimeout> | null;
  destroyed: boolean;
}
const directives = new WeakMap<object, DirectiveState>();

/**
 * `[cdkCopyToClipboard]` click behaviour: copies `options.text`, retrying up to `attempts` times
 * (1 ms apart) when the browser refuses, then calls `copied(successful)` once. `owner` identifies the
 * trigger (usually `event.currentTarget`), so `destroyCopyToClipboard(owner)` can cancel retries.
 */
export function copyToClipboard(owner: object, options: CopyToClipboardOptions): void {
  let state = directives.get(owner);
  if (!state) directives.set(owner, (state = { pending: new Set(), timeout: null, destroyed: false }));
  state.destroyed = false;
  // Avoid an infinite loop when a large number of attempts is passed in.
  const attempts = Math.min(options.attempts ?? 1, 50);
  if (attempts > 1) {
    let remaining = attempts;
    const pending = _clipboard.beginCopy(options.text);
    state.pending.add(pending);
    const s = state;
    const attempt = (): void => {
      const successful = pending.copy();
      if (!successful && --remaining && !s.destroyed) s.timeout = setTimeout(attempt, 1);
      else {
        s.timeout = null;
        s.pending.delete(pending);
        pending.destroy();
        options.copied?.(successful);
      }
    };
    attempt();
  } else options.copied?.(_clipboard.copy(options.text));
}

/** Directive `ngOnDestroy`: stop retrying and destroy pending copies started for `owner`. */
export function destroyCopyToClipboard(owner: object): void {
  const state = directives.get(owner);
  if (!state) return;
  if (state.timeout) clearTimeout(state.timeout);
  for (const pending of state.pending) pending.destroy();
  state.pending.clear();
  state.destroyed = true;
}

/**
 * Copy `text` with `navigator.clipboard.writeText`, falling back to `copyText` (insecure contexts,
 * refused permission); resolves true when the clipboard accepted it.
 */
export async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyText(text);
  }
}
