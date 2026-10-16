// Ported from angular/components src/cdk/text-field (MIT, © Google LLC): `CdkTextareaAutosize`,
// `AutofillMonitor`, `CdkAutofill`, `AutofillEvent`, the text-field structural styles.
//
// Rivet:
// - Zero JS: `autosizeProps({ minRows, maxRows, native: true })` (style = object of CSS variables) → CSS `field-sizing: content`
//   (import `@rivetjs/cdk/text-field.css`). Browsers without `field-sizing` keep the fixed height.
// - 1:1 behaviour: `autosizeTextarea(textarea, options)` from a client effect or a focus / input
//   handler. It returns the `CdkTextareaAutosize` controller (minRows / maxRows / enabled /
//   placeholder setters, `resizeToFitContent(force)`, `reset()`, `destroy()`); `textareaAutosize(el)`
//   finds an attached one. Angular's `ngDoCheck` (resize on every change detection) becomes an
//   `input` listener plus an instance `value` accessor, so programmatic writes (signal bindings,
//   forms) resize too.
// - `AutofillMonitor` is `createAutofillMonitor()` / the shared `autofillMonitor()`; `onAutofill(el,
//   fn)` is the `cdkAutofill` directive. The monitor injects its styles on first use (Angular's
//   private style loader); SSR pages can import `text-field.css` instead.
// Nothing runs at import time.
import { coerceElement, coerceNumberProperty, type NumberInput } from "../coercion/index.ts";
import { getPlatform, normalizePassiveListenerOptions } from "../platform/index.ts";
import { getNonce } from "../utils/dom.ts";
import { _Subject, type Observable } from "../observers/index.ts";

const STYLE_ATTR = "data-cdk-text-field";
const STYLES =
  "textarea.cdk-textarea-autosize{resize:none}" +
  "textarea.cdk-textarea-autosize-measuring{padding:2px 0!important;box-sizing:content-box!important;height:auto!important;overflow:hidden!important}" +
  "textarea.cdk-textarea-autosize-measuring-firefox{padding:2px 0!important;box-sizing:content-box!important;height:0!important}" +
  "@keyframes cdk-text-field-autofill-start{/*!*/}@keyframes cdk-text-field-autofill-end{/*!*/}" +
  ".cdk-text-field-autofill-monitored:-webkit-autofill{animation:cdk-text-field-autofill-start 0s 1ms}" +
  ".cdk-text-field-autofill-monitored:not(:-webkit-autofill){animation:cdk-text-field-autofill-end 0s 1ms}";

/** Angular `_CdkPrivateStyleLoader.load(_CdkTextFieldStyleLoader)`: once per document. */
function loadStyles(doc: Document): void {
  if (doc.head.querySelector(`style[${STYLE_ATTR}]`)) return;
  const style = doc.createElement("style");
  style.setAttribute(STYLE_ATTR, "");
  const nonce = getNonce(doc);
  if (nonce) style.setAttribute("nonce", nonce);
  style.textContent = STYLES;
  doc.head.prepend(style);
}

// ---------------------------------------------------------------------------------------------------
// Autosize

export interface TextareaAutosizeOptions {
  /** `cdkAutosizeMinRows`. */
  minRows?: NumberInput;
  /** `cdkAutosizeMaxRows`. */
  maxRows?: NumberInput;
  /** `cdkTextareaAutosize` (default true). */
  enabled?: boolean;
  /** `placeholder` input: sets / removes the attribute; the textarea is at least as tall as it. */
  placeholder?: string | null;
}

/**
 * Host attributes for an autosize textarea (SSR markup): `class`, `rows=1`; `native` adds the CSS path and, with
 * `minRows` / `maxRows`, a `style` object of the CSS variables (spreads onto the `TextArea` part or a `<textarea>`).
 */
export function autosizeProps(options: { minRows?: NumberInput; maxRows?: NumberInput; native?: boolean } = {}): {
  class: string;
  rows: number;
  style?: Record<string, number>;
} {
  if (!options.native) return { class: "cdk-textarea-autosize", rows: 1 };
  const style: Record<string, number> = {};
  const min = coerceNumberProperty(options.minRows);
  const max = coerceNumberProperty(options.maxRows);
  if (min) style["--cdk-autosize-min-rows"] = min;
  if (max) style["--cdk-autosize-max-rows"] = max;
  return { class: "cdk-textarea-autosize cdk-textarea-autosize-native", rows: 1, ...(min || max ? { style } : {}) };
}

/** Angular `CdkTextareaAutosize` (exported as `cdkTextareaAutosize`). */
export interface TextareaAutosize {
  readonly minRows: number;
  readonly maxRows: number;
  readonly enabled: boolean;
  readonly placeholder: string;
  setMinRows(value: NumberInput): void;
  setMaxRows(value: NumberInput): void;
  /** Enabling resizes to fit (forced); disabling restores the initial height. */
  setEnabled(value: boolean): void;
  setPlaceholder(value: string | null | undefined): void;
  /** Resize to the content; skipped when value and minRows are unchanged unless `force`. */
  resizeToFitContent(force?: boolean): void;
  /** Restore the height the textarea had before autosize. */
  reset(): void;
  /** Remove listeners and the `value` hook. */
  destroy(): void;
}

const controllers = new WeakMap<HTMLTextAreaElement, TextareaAutosize>();

/** The `TextareaAutosize` attached to `textarea`, if any. */
export function textareaAutosize(textarea: HTMLTextAreaElement): TextareaAutosize | undefined {
  return controllers.get(textarea);
}

/** Attach `CdkTextareaAutosize` to `textarea` (or return the attached one, updated with `options`). */
export function autosizeTextarea(
  textareaOrRef: HTMLTextAreaElement | (() => HTMLTextAreaElement | null | undefined),
  options: TextareaAutosizeOptions = {},
): TextareaAutosize {
  const textarea = coerceElement(textareaOrRef) as HTMLTextAreaElement;
  const existing = controllers.get(textarea);
  if (existing) {
    applyOptions(existing, options);
    return existing;
  }
  const platform = getPlatform();
  const doc = textarea.ownerDocument;
  const win = doc.defaultView!;
  loadStyles(doc);
  // Host bindings.
  textarea.classList.add("cdk-textarea-autosize");
  textarea.rows = 1;

  let minRows = 0;
  let maxRows = 0;
  let enabled = true;
  let previousMinRows = -1;
  let previousValue: string | undefined;
  let cachedLineHeight: number | undefined;
  let cachedPlaceholderHeight: number | undefined;
  let hasFocus = false;
  let isViewInited = false;
  let destroyed = false;
  let initialHeight: string | undefined;

  const setMinHeight = () => {
    const minHeight = minRows && cachedLineHeight ? `${minRows * cachedLineHeight}px` : null;
    if (minHeight) textarea.style.minHeight = minHeight;
  };
  const setMaxHeight = () => {
    const maxHeight = maxRows && cachedLineHeight ? `${maxRows * cachedLineHeight}px` : null;
    if (maxHeight) textarea.style.maxHeight = maxHeight;
  };

  // Line height from a hidden one-row clone (no padding / border).
  const cacheTextareaLineHeight = () => {
    if (cachedLineHeight) return;
    const clone = textarea.cloneNode(false) as HTMLTextAreaElement;
    const s = clone.style;
    clone.rows = 1;
    s.position = "absolute";
    s.visibility = "hidden";
    s.border = "none";
    s.padding = "0";
    s.height = "";
    s.minHeight = "";
    s.maxHeight = "";
    // App styles may set `top` etc.; the clone must not affect the layout (and scroll position).
    s.top = s.bottom = s.left = s.right = "auto";
    // Hidden overflow: a scrollbar could make the content wrap and the clone taller.
    s.overflow = "hidden";
    textarea.parentNode!.appendChild(clone);
    cachedLineHeight = clone.clientHeight;
    clone.remove();
    setMinHeight();
    setMaxHeight();
  };

  const measureScrollHeight = (): number => {
    const previousMargin = textarea.style.marginBottom || "";
    const measuringClass = platform.FIREFOX ? "cdk-textarea-autosize-measuring-firefox" : "cdk-textarea-autosize-measuring";
    // Focused textarea: the height change would scroll the page; a margin keeps the layout stable.
    const needsMarginFiller = hasFocus;
    if (needsMarginFiller) textarea.style.marginBottom = `${textarea.clientHeight}px`;
    textarea.classList.add(measuringClass);
    // 4px: the 2px top / bottom measuring padding.
    const scrollHeight = textarea.scrollHeight - 4;
    textarea.classList.remove(measuringClass);
    if (needsMarginFiller) textarea.style.marginBottom = previousMargin;
    return scrollHeight;
  };

  const cacheTextareaPlaceholderHeight = () => {
    if (!isViewInited || cachedPlaceholderHeight != undefined) return;
    if (!textarea.placeholder) {
      cachedPlaceholderHeight = 0;
      return;
    }
    const value = nativeValue.get!.call(textarea) as string;
    nativeValue.set!.call(textarea, textarea.placeholder);
    cachedPlaceholderHeight = measureScrollHeight();
    nativeValue.set!.call(textarea, value);
  };

  const scrollToCaretPosition = () => {
    const { selectionStart, selectionEnd } = textarea;
    // Re-setting the selection scrolls the caret into view (Chrome / Firefox keep it hidden after a
    // height change while the textarea is focused).
    if (!destroyed && hasFocus) textarea.setSelectionRange(selectionStart, selectionEnd);
  };

  const resizeToFitContent = (force = false) => {
    if (!enabled) return;
    cacheTextareaLineHeight();
    cacheTextareaPlaceholderHeight();
    // Not in the DOM / hidden: nothing to measure.
    if (!cachedLineHeight) return;
    const value = nativeValue.get!.call(textarea) as string;
    if (!force && minRows === previousMinRows && value === previousValue) return;
    const height = Math.max(measureScrollHeight(), cachedPlaceholderHeight || 0);
    textarea.style.height = `${height}px`;
    if (typeof win.requestAnimationFrame !== "undefined") win.requestAnimationFrame(scrollToCaretPosition);
    else setTimeout(scrollToCaretPosition);
    previousValue = value;
    previousMinRows = minRows;
  };

  // `ngDoCheck`: resize after programmatic value writes.
  const nativeValue = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!;
  Object.defineProperty(textarea, "value", {
    configurable: true,
    enumerable: true,
    get() {
      return nativeValue.get!.call(this);
    },
    set(next: string) {
      nativeValue.set!.call(this, next);
      if (isViewInited) resizeToFitContent();
    },
  });

  // `window` resize, audited to 16ms; resets the cached heights.
  let auditTimer: ReturnType<typeof setTimeout> | undefined;
  const onWindowResize = () => {
    if (auditTimer !== undefined) return;
    auditTimer = setTimeout(() => {
      auditTimer = undefined;
      cachedLineHeight = cachedPlaceholderHeight = undefined;
      controller.resizeToFitContent(true);
    }, 16);
  };
  const onFocus = (event: FocusEvent) => {
    hasFocus = event.type === "focus";
  };
  const onInput = () => resizeToFitContent();
  win.addEventListener("resize", onWindowResize);
  textarea.addEventListener("focus", onFocus);
  textarea.addEventListener("blur", onFocus);
  textarea.addEventListener("input", onInput);

  const controller: TextareaAutosize = {
    get minRows() {
      return minRows;
    },
    get maxRows() {
      return maxRows;
    },
    get enabled() {
      return enabled;
    },
    get placeholder() {
      return textarea.placeholder;
    },
    setMinRows(value) {
      minRows = coerceNumberProperty(value);
      setMinHeight();
      if (isViewInited) resizeToFitContent();
    },
    setMaxRows(value) {
      maxRows = coerceNumberProperty(value);
      setMaxHeight();
    },
    setEnabled(value) {
      if (enabled !== value) (enabled = value) ? resizeToFitContent(true) : controller.reset();
    },
    setPlaceholder(value) {
      cachedPlaceholderHeight = undefined;
      if (value) textarea.setAttribute("placeholder", value);
      else textarea.removeAttribute("placeholder");
      cacheTextareaPlaceholderHeight();
      if (isViewInited) resizeToFitContent(true);
    },
    resizeToFitContent: (force) => resizeToFitContent(force),
    reset() {
      // Not initialized yet: undefined (keep the height).
      if (initialHeight !== undefined) textarea.style.height = initialHeight;
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clearTimeout(auditTimer);
      win.removeEventListener("resize", onWindowResize);
      textarea.removeEventListener("focus", onFocus);
      textarea.removeEventListener("blur", onFocus);
      textarea.removeEventListener("input", onInput);
      delete (textarea as { value?: string }).value;
      controllers.delete(textarea);
    },
  };

  applyOptions(controller, options);
  // `ngAfterViewInit`.
  initialHeight = textarea.style.height;
  hasFocus = doc.activeElement === textarea;
  resizeToFitContent();
  isViewInited = true;
  resizeToFitContent(true);
  controllers.set(textarea, controller);
  return controller;
}

function applyOptions(controller: TextareaAutosize, options: TextareaAutosizeOptions): void {
  if ("minRows" in options) controller.setMinRows(options.minRows);
  if ("maxRows" in options) controller.setMaxRows(options.maxRows);
  if ("placeholder" in options) controller.setPlaceholder(options.placeholder);
  if (options.enabled !== undefined) controller.setEnabled(options.enabled);
}

// ---------------------------------------------------------------------------------------------------
// Autofill

/** An autofill state change. */
export type AutofillEvent = {
  /** The element whose autofill state changed. */
  target: Element;
  /** Whether it is now autofilled. */
  isAutofilled: boolean;
};

const EMPTY: Observable<never> = {
  subscribe(observer) {
    if (observer && typeof observer !== "function") observer.complete?.();
    return { unsubscribe() {} };
  },
};

const listenerOptions = { passive: true };

/** Angular `AutofillMonitor`: autofill state of inputs via `animationstart` on keyframes. */
export interface AutofillMonitor {
  /** Autofill changes of `element`; the same stream for repeated calls. Server: completes at once. */
  monitor(element: Element | (() => Element | null | undefined)): Observable<AutofillEvent>;
  /** Stop monitoring: removes the listener and classes, completes the stream. */
  stopMonitoring(element: Element | (() => Element | null | undefined)): void;
  /** `ngOnDestroy`: stops monitoring every element. */
  destroy(): void;
}

export function createAutofillMonitor(): AutofillMonitor {
  const monitored = new Map<Element, { subject: _Subject<AutofillEvent>; unlisten: () => void }>();
  const monitor: AutofillMonitor = {
    monitor(elementOrRef) {
      if (!getPlatform().isBrowser) return EMPTY;
      const element = coerceElement(elementOrRef) as Element;
      loadStyles(element.ownerDocument);
      const info = monitored.get(element);
      if (info) return info.subject;
      const subject = new _Subject<AutofillEvent>();
      const cssClass = "cdk-text-field-autofilled";
      const listener = (event: AnimationEvent) => {
        // Start / end animations fire when the `:-webkit-autofill` state changes; the class guards
        // against duplicate events (e.g. the initial "end" of an unfilled input).
        if (event.animationName === "cdk-text-field-autofill-start" && !element.classList.contains(cssClass)) {
          element.classList.add(cssClass);
          subject.next({ target: event.target as Element, isAutofilled: true });
        } else if (event.animationName === "cdk-text-field-autofill-end" && element.classList.contains(cssClass)) {
          element.classList.remove(cssClass);
          subject.next({ target: event.target as Element, isAutofilled: false });
        }
      };
      const options = normalizePassiveListenerOptions(listenerOptions);
      element.classList.add("cdk-text-field-autofill-monitored");
      element.addEventListener("animationstart", listener as EventListener, options);
      const unlisten = () => element.removeEventListener("animationstart", listener as EventListener, options);
      monitored.set(element, { subject, unlisten });
      return subject;
    },
    stopMonitoring(elementOrRef) {
      const element = coerceElement(elementOrRef) as Element;
      const info = monitored.get(element);
      if (!info) return;
      info.unlisten();
      info.subject.complete();
      element.classList.remove("cdk-text-field-autofill-monitored");
      element.classList.remove("cdk-text-field-autofilled");
      monitored.delete(element);
    },
    destroy() {
      for (const element of [...monitored.keys()]) monitor.stopMonitoring(element);
    },
  };
  return monitor;
}

let sharedAutofill: AutofillMonitor | undefined;

/** The shared `AutofillMonitor` (Angular root service), created on first use. */
export function autofillMonitor(): AutofillMonitor {
  return (sharedAutofill ??= createAutofillMonitor());
}

/** `cdkAutofill`: `onChange(event)` on autofill changes of `element`. Returns the cleanup (stops monitoring). */
export function onAutofill(
  element: Element | (() => Element | null | undefined),
  onChange: (event: AutofillEvent) => void,
  options: { monitor?: AutofillMonitor } = {},
): () => void {
  const m = options.monitor ?? autofillMonitor();
  const subscription = m.monitor(element).subscribe(onChange);
  return () => {
    subscription.unsubscribe();
    m.stopMonitoring(element);
  };
}
