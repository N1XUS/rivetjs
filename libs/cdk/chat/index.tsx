// Rivet-authored (no React Aria / Angular CDK counterpart). Headless behaviour for chat surfaces; feature set inspired by
// commercial UI kits' public AI component docs (PromptInput Enter / Shift+Enter, autosizing composer, stick-to-bottom
// conversation with a jump-to-bottom button, file drop on the composer, streamed responses); independent implementation.
// - Plain functions called from resumable handlers (`onKeyDown={(e) => { if (isSubmitKey(e)) … }}`): nothing runs at load.
// - Stick-to-bottom is CSS first (`flex-direction: column-reverse` scroll container: the browser starts at the bottom and
//   keeps it there while content grows); these helpers only measure / scroll for the jump button and its visibility.
// - `.tsx` (not `.ts`): the package's `./*` export maps to `<name>/index.tsx`, and closures of `.ts` modules never resume.
import { effect } from "@rivetjs/reactivity";
import type { Signal } from "@rivetjs/reactivity";

/* -------------------------------------------------------------------------------------------------
 * Composer keys
 * -----------------------------------------------------------------------------------------------*/

/**
 * Enter submits a composer; Shift+Enter inserts a newline (when `allowsNewlines`, default). Never during IME composition
 * (`isComposing` / keyCode 229: Enter confirms the candidate), never with Alt. Call `preventDefault()` when it returns true.
 */
export function isSubmitKey(event: KeyboardEvent, allowsNewlines = true): boolean {
  if (event.key !== "Enter" || event.isComposing || event.keyCode === 229 || event.altKey) return false;
  return event.shiftKey ? !allowsNewlines : true;
}

let fieldSizing: boolean | undefined;

/** Whether the browser sizes a textarea to its content in CSS (`field-sizing: content`). */
export function supportsFieldSizing(): boolean {
  return (fieldSizing ??= typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content"));
}

/**
 * Grow `textarea` to its content up to `maxHeight` px (the CSS `max-height` when omitted). A no-op where CSS
 * `field-sizing: content` already does it; call it from the `input` handler (fallback for browsers without it).
 */
export function autosizeTextArea(textarea: HTMLTextAreaElement, maxHeight?: number): void {
  if (supportsFieldSizing()) return;
  const style = textarea.style;
  style.height = "auto";
  const limit = maxHeight ?? (parseFloat(getComputedStyle(textarea).maxHeight) || Infinity);
  const height = Math.min(textarea.scrollHeight, limit);
  style.height = `${height}px`;
  style.overflowY = textarea.scrollHeight > limit ? "auto" : "hidden";
}

/* -------------------------------------------------------------------------------------------------
 * Stick to bottom
 * -----------------------------------------------------------------------------------------------*/

/** Distance below which a conversation counts as "at the bottom" (px). */
export const AT_BOTTOM_THRESHOLD = 24;

const reversed = (el: Element): boolean => getComputedStyle(el).flexDirection === "column-reverse";

/** Pixels between the visible bottom edge of `el` and the end of its content (works for `column-reverse` containers). */
export function distanceFromBottom(el: Element): number {
  // column-reverse: scrollTop is 0 at the bottom and negative above it (CSSOM View, all current engines).
  if (reversed(el)) return Math.max(0, -el.scrollTop);
  return Math.max(0, el.scrollHeight - el.clientHeight - el.scrollTop);
}

/** Whether `el` is scrolled to (within `threshold` px of) its end. */
export function isAtBottom(el: Element, threshold = AT_BOTTOM_THRESHOLD): boolean {
  return distanceFromBottom(el) <= threshold;
}

/** Scroll `el` to the end of its content. */
export function scrollToBottom(el: Element, behavior: ScrollBehavior = "smooth"): void {
  const top = reversed(el) ? 0 : el.scrollHeight;
  if (typeof el.scrollTo === "function") el.scrollTo({ top, behavior });
  else el.scrollTop = top;
}

/** Writes `data-at-bottom="true"` (or removes it) on `el` from its scroll position; returns the state. Call it on `scroll`. */
export function syncAtBottom(el: Element, threshold = AT_BOTTOM_THRESHOLD): boolean {
  const atBottom = isAtBottom(el, threshold);
  if (atBottom) el.setAttribute("data-at-bottom", "true");
  else el.removeAttribute("data-at-bottom");
  return atBottom;
}

/** The scroll container of a conversation part (`[data-chat-viewport]` ancestor of `from`). */
export function conversationViewportOf(from: Element | null): HTMLElement | null {
  return (from?.closest("[data-chat-viewport]") as HTMLElement | null) ?? null;
}

/* -------------------------------------------------------------------------------------------------
 * Files (drop / pick)
 * -----------------------------------------------------------------------------------------------*/

/** Whether a drag carries files (`dataTransfer.types` includes "Files"). */
export function dragHasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  if (!types) return false;
  for (let i = 0; i < types.length; i++) if (types[i] === "Files") return true;
  return false;
}

/**
 * `accept` filter of a file input (`".pdf,image/*,text/plain"`) applied to `file`: extensions, exact MIME types and
 * `type/*` wildcards; an empty / missing filter accepts everything.
 */
export function acceptsFile(file: { name: string; type: string }, accept?: string): boolean {
  if (!accept) return true;
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  for (const raw of accept.split(",")) {
    const rule = raw.trim().toLowerCase();
    if (!rule) continue;
    if (rule.startsWith(".") ? name.endsWith(rule) : rule.endsWith("/*") ? type.startsWith(rule.slice(0, -1)) : type === rule) return true;
  }
  return false;
}

/** Files of a drop / input change, filtered by `accept`, at most one unless `multiple`. */
export function selectedFiles(list: FileList | readonly File[] | null | undefined, accept?: string, multiple = true): File[] {
  const out: File[] = [];
  if (!list) return out;
  for (let i = 0; i < list.length; i++) {
    const file = list[i]!;
    if (acceptsFile(file, accept)) out.push(file);
    if (!multiple && out.length === 1) break;
  }
  return out;
}

/* -------------------------------------------------------------------------------------------------
 * Streaming text
 * -----------------------------------------------------------------------------------------------*/

export interface StreamTextOptions {
  /** Stops reading (the promise resolves with the text so far). */
  signal?: AbortSignal;
  /** Called after each appended chunk with the whole text. */
  onChunk?: (text: string, chunk: string) => void;
}

type TextSource = AsyncIterable<string | Uint8Array> | ReadableStream<string | Uint8Array>;

/**
 * Append every chunk of `source` (an async iterable or a `ReadableStream` of strings / UTF-8 bytes, e.g. a `fetch` body)
 * to `target`; resolves with the full text. One signal write per chunk: bindings reading `target` update in place.
 */
export async function streamText(target: Signal<string>, source: TextSource, options: StreamTextOptions = {}): Promise<string> {
  const decoder = new TextDecoder();
  const append = (chunk: string | Uint8Array): void => {
    const piece = typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    if (!piece) return;
    const next = target() + piece;
    target.set(next);
    options.onChunk?.(next, piece);
  };
  const abort = options.signal;
  if (typeof (source as ReadableStream).getReader === "function") {
    const reader = (source as ReadableStream<string | Uint8Array>).getReader();
    const stop = () => void reader.cancel().catch(() => {});
    abort?.addEventListener("abort", stop, { once: true });
    try {
      while (!abort?.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        append(value);
      }
    } finally {
      abort?.removeEventListener("abort", stop);
      reader.releaseLock();
    }
  } else {
    for await (const chunk of source as AsyncIterable<string | Uint8Array>) {
      if (abort?.aborted) break;
      append(chunk);
    }
  }
  return target();
}

export interface SimulatedStreamOptions {
  /** Delay between chunks (ms); the mean delay with `jitter`. @default 30 */
  interval?: number;
  /** Words per chunk; the mean size with `jitter`. @default 1 */
  wordsPerChunk?: number;
  /**
   * 0 … 1: how much chunk sizes and delays vary around `wordsPerChunk` / `interval` (a natural model cadence: bursts of a
   * few words, short pauses, a longer pause after a sentence). `0` = fixed ticks. @default 0
   */
  jitter?: number;
  /** Random source in [0, 1) for `jitter` (tests pass a seeded one). @default Math.random */
  random?: () => number;
  signal?: AbortSignal;
}

/**
 * `text` as an async iterable of word-sized chunks on a local timer (demos, tests, offline fallbacks): no network.
 * Whitespace is kept with the word before it, so the joined chunks equal `text`.
 */
export async function* simulateStream(text: string, options: SimulatedStreamOptions = {}): AsyncGenerator<string> {
  const interval = options.interval ?? 30;
  const per = Math.max(1, options.wordsPerChunk ?? 1);
  const jitter = Math.min(1, Math.max(0, options.jitter ?? 0));
  const random = options.random ?? Math.random;
  const words = text.match(/\S+\s*|\s+/g) ?? [];
  for (let i = 0; i < words.length;) {
    if (options.signal?.aborted) return;
    // Size: per ± jitter (at least one word). Delay: interval ± jitter, longer after a sentence or a line break.
    const size = jitter ? Math.max(1, Math.round(per * (1 + jitter * (random() * 2 - 1)))) : per;
    const previous = i > 0 ? words[i - 1]! : "";
    const pause = jitter && /[.!?:]\s*$|\n/.test(previous) ? 1 + 3 * jitter : 1;
    const delay = jitter ? interval * pause * (1 + jitter * (random() * 2 - 1)) : interval;
    await new Promise((resolve) => setTimeout(resolve, Math.max(0, delay)));
    if (options.signal?.aborted) return;
    yield words.slice(i, i + size).join("");
    i += size;
  }
}

export { followText, textGraphemes, type TextRevealOptions } from "./text-reveal/index.tsx";

/* -------------------------------------------------------------------------------------------------
 * Smooth growth
 * -----------------------------------------------------------------------------------------------*/

export interface FollowHeightOptions {
  /** Top growth speed (px per second): no frame steps more than `maxSpeed / 60` px at 60 fps. @default 240 */
  maxSpeed?: number;
  /** Ease-out time constant (ms): the height closes ≈ 63 % of the remaining gap per `smoothing` ms. @default 90 */
  smoothing?: number;
}

const reducedMotion = (): boolean => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Natural height of `el`'s content while its own height is pinned: the contents' range box (descendants overflowing the
 * pinned box included) plus the last child's bottom margin and `el`'s bottom padding / border. Not `scrollHeight`: with
 * `overflow: clip` the element is no scroll container and `scrollHeight` stops at the pinned height.
 */
function contentHeight(el: HTMLElement): number {
  const top = el.getBoundingClientRect().top;
  const range = el.ownerDocument.createRange();
  range.selectNodeContents(el);
  const style = getComputedStyle(el);
  const last = el.lastElementChild;
  const margin = last ? parseFloat(getComputedStyle(last).marginBottom) || 0 : 0;
  return Math.ceil(range.getBoundingClientRect().bottom - top + margin + (parseFloat(style.paddingBottom) || 0) + (parseFloat(style.borderBottomWidth) || 0));
}

/**
 * While `active()` is true, `el` grows smoothly instead of jumping a line / block at a time: its height is pinned in px
 * (`overflow: clip`) and eased toward its content height (range box of its contents) one rAF step per frame, each step
 * capped at `maxSpeed` (no single-frame jump), shrinking the same way. DOM changes (MutationObserver) wake the loop;
 * it sleeps once the height has settled. When `active()` turns false the last growth finishes and the height is
 * released to `auto`. Reduced motion / no MutationObserver: a no-op. Browser only. Returns a disposer.
 */
export function followHeight(el: HTMLElement, active: () => boolean, options: FollowHeightOptions = {}): () => void {
  if (typeof MutationObserver === "undefined" || typeof requestAnimationFrame !== "function" || reducedMotion()) return () => {};
  const style = el.style;
  const maxSpeed = options.maxSpeed ?? 240;
  const smoothing = options.smoothing ?? 90;
  let frame = 0;
  let on = false;
  let pinned = false;
  let height = 0;
  let last = 0;
  const release = (): void => {
    pinned = false;
    style.height = "";
    style.overflow = "";
  };
  const step = (now: number): void => {
    frame = 0;
    const dt = last ? Math.min(now - last, 50) : 1000 / 60;
    last = now;
    const gap = contentHeight(el) - height;
    if (Math.abs(gap) < 0.5) {
      height += gap;
      style.height = `${height}px`;
      last = 0;
      if (!on) release();
      return;
    }
    const eased = Math.abs(gap) * (1 - Math.exp(-dt / smoothing));
    height += Math.sign(gap) * Math.max(0.5, Math.min(eased, (maxSpeed * dt) / 1000));
    style.height = `${height}px`;
    frame = requestAnimationFrame(step);
  };
  const wake = (): void => {
    if (!frame && pinned) frame = requestAnimationFrame(step);
  };
  const observer = new MutationObserver(wake);
  const start = (): void => {
    if (on) return;
    on = true;
    if (!pinned) {
      pinned = true;
      height = el.getBoundingClientRect().height;
      style.height = `${height}px`;
      style.overflow = "clip";
    }
    observer.observe(el, { subtree: true, childList: true, characterData: true });
    wake();
  };
  // The loop keeps measuring until the height settles (the finished markup may still change after the stream ends).
  const stop = (): void => {
    if (!on) return;
    on = false;
    observer.disconnect();
    wake();
  };
  const dispose = effect(() => {
    if (active()) start();
    else stop();
  });
  return () => {
    dispose();
    on = false;
    observer.disconnect();
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    if (pinned) release();
  };
}

/* -------------------------------------------------------------------------------------------------
 * Prompt tokens (mentions / commands in a plain textarea)
 * -----------------------------------------------------------------------------------------------*/
// The value is a segment list; its flattened text is exactly the textarea's text, so the field stays a native
// `<textarea>` (no contenteditable): tokens are atomic ranges of that text. Edits that touch a token remove the whole
// token; the caret never rests inside one. Pure functions: callers (ui `PromptInputTokenInput`) apply the result to the
// textarea and their state.

/** A run of plain text. */
export interface PromptTextSegment {
  type: "text";
  text: string;
}

/** An atomic token (`@ana`, `/summarize`): `text` is what the field shows, `value` an optional id. */
export interface PromptTokenSegment {
  type: "token";
  text: string;
  /** Identifier carried with the token (user id, command name). */
  value?: string;
  /** The trigger that opened the menu the token was picked from (`@`, `/`). */
  trigger?: string;
}

export type PromptSegment = PromptTextSegment | PromptTokenSegment;

/** A prompt as segments (resume-format data: plain objects). */
export type PromptTokenValue = readonly PromptSegment[];

/** An edit result: the next value and the caret to place (flat text offset). */
export interface PromptTokenEdit {
  value: PromptSegment[];
  caret: number;
}

/** The active trigger before the caret: `start` = the trigger's offset, `query` = the text typed after it. */
export interface PromptTokenMatch {
  trigger: string;
  start: number;
  query: string;
}

/** The value as one string (what the textarea shows; what Send submits). */
export function promptTokenText(value: PromptTokenValue): string {
  let text = "";
  for (const segment of value) text += segment.text;
  return text;
}

/** Merge neighbouring text runs, drop empty runs and empty tokens. */
export function normalizePromptTokens(value: PromptTokenValue): PromptSegment[] {
  const out: PromptSegment[] = [];
  for (const segment of value) {
    if (!segment.text) continue;
    const last = out[out.length - 1];
    if (segment.type === "text" && last?.type === "text") out[out.length - 1] = { type: "text", text: last.text + segment.text };
    else out.push(segment.type === "text" ? { type: "text", text: segment.text } : { ...segment });
  }
  return out;
}

/** Every token with its flat `[start, end)` range. */
export function promptTokenRanges(value: PromptTokenValue): Array<{ start: number; end: number; token: PromptTokenSegment; index: number }> {
  const ranges: Array<{ start: number; end: number; token: PromptTokenSegment; index: number }> = [];
  let offset = 0;
  value.forEach((segment, index) => {
    const end = offset + segment.text.length;
    if (segment.type === "token") ranges.push({ start: offset, end, token: segment, index });
    offset = end;
  });
  return ranges;
}

/** The segments covering flat `[start, end)` (text runs cut at the edges; tokens are kept whole or dropped by the caller). */
function slicePromptTokens(value: PromptTokenValue, start: number, end: number): PromptSegment[] {
  const out: PromptSegment[] = [];
  let offset = 0;
  for (const segment of value) {
    const a = offset;
    const b = offset + segment.text.length;
    offset = b;
    if (b <= start || a >= end) continue;
    if (segment.type === "token") {
      out.push({ ...segment });
      continue;
    }
    out.push({ type: "text", text: segment.text.slice(Math.max(0, start - a), Math.min(segment.text.length, end - a)) });
  }
  return out;
}

/** Grow `[start, end)` to whole tokens: any token the range overlaps (or a caret strictly inside) is included. */
export function expandToPromptTokens(value: PromptTokenValue, start: number, end: number): [number, number] {
  let from = start;
  let to = end;
  for (const range of promptTokenRanges(value)) {
    const overlaps = start === end ? range.start < start && start < range.end : range.start < end && range.end > start;
    if (!overlaps) continue;
    from = Math.min(from, range.start);
    to = Math.max(to, range.end);
  }
  return [from, to];
}

/** Replace flat `[start, end)` (grown to whole tokens) with `insert`. The caret lands after the insertion. */
export function replacePromptTokens(value: PromptTokenValue, start: number, end: number, insert: readonly PromptSegment[] = []): PromptTokenEdit {
  const [from, to] = expandToPromptTokens(value, start, end);
  const total = promptTokenText(value).length;
  const next = normalizePromptTokens([...slicePromptTokens(value, 0, from), ...insert, ...slicePromptTokens(value, to, total)]);
  return { value: next, caret: from + promptTokenText(insert).length };
}

/**
 * Reconcile a native textarea edit: `text` is the field's new text, `caret` its caret after the edit (bounds the diff so
 * repeated characters resolve to the caret's side). The changed range is grown to whole tokens: deleting or typing into a
 * token removes it. Returns the next value (its text may differ from `text`: write it back with the caret).
 */
export function applyPromptTextEdit(value: PromptTokenValue, text: string, caret = text.length): PromptTokenEdit {
  const previous = promptTokenText(value);
  if (previous === text) return { value: normalizePromptTokens(value), caret };
  const limit = Math.min(previous.length, text.length);
  let suffix = 0;
  const suffixLimit = Math.min(limit, Math.max(0, text.length - caret));
  while (suffix < suffixLimit && previous[previous.length - 1 - suffix] === text[text.length - 1 - suffix]) suffix++;
  let prefix = 0;
  const prefixLimit = limit - suffix;
  while (prefix < prefixLimit && previous[prefix] === text[prefix]) prefix++;
  const inserted = text.slice(prefix, text.length - suffix);
  return replacePromptTokens(value, prefix, previous.length - suffix, inserted ? [{ type: "text", text: inserted }] : []);
}

/**
 * Backspace (`"backward"`) / Delete (`"forward"`) at a collapsed caret next to a token: removes the whole token. Returns
 * null when no token touches the caret on that side (let the native key run).
 */
export function deletePromptToken(value: PromptTokenValue, caret: number, direction: "backward" | "forward"): PromptTokenEdit | null {
  for (const range of promptTokenRanges(value)) {
    const hit = direction === "backward" ? range.start < caret && caret <= range.end : range.start <= caret && caret < range.end;
    if (hit) return replacePromptTokens(value, range.start, range.end);
  }
  return null;
}

/**
 * Where a collapsed caret may rest: a caret inside a token moves to its nearer edge (`"nearest"`), or past it in the
 * movement direction (`"backward"` / `"forward"`: arrow keys step over a token in one press).
 */
export function snapPromptCaret(value: PromptTokenValue, caret: number, direction: "nearest" | "backward" | "forward" = "nearest"): number {
  for (const range of promptTokenRanges(value)) {
    if (!(range.start < caret && caret < range.end)) continue;
    if (direction === "backward") return range.start;
    if (direction === "forward") return range.end;
    return caret - range.start <= range.end - caret ? range.start : range.end;
  }
  return caret;
}

/** The token whose edge an arrow key at `caret` would cross (`ArrowLeft` from its end, `ArrowRight` from its start). */
export function promptTokenStep(value: PromptTokenValue, caret: number, direction: "backward" | "forward"): number | null {
  for (const range of promptTokenRanges(value)) {
    if (direction === "backward" && caret === range.end) return range.start;
    if (direction === "forward" && caret === range.start) return range.end;
  }
  return null;
}

/**
 * The trigger the caret is typing after: a trigger string at a word boundary (field start or after whitespace) in the
 * plain text before the caret, followed by a query without a newline (and without spaces unless `allowsSpaces`). The
 * nearest trigger before the caret wins; null inside / right after a token run without a trigger.
 */
export function findPromptTrigger(value: PromptTokenValue, caret: number, triggers: readonly string[], allowsSpaces = false): PromptTokenMatch | null {
  if (!triggers.length) return null;
  // The plain-text run that ends at the caret (tokens bound it).
  let runStart = 0;
  for (const range of promptTokenRanges(value)) {
    if (range.start < caret && caret < range.end) return null;
    if (range.end <= caret) runStart = range.end;
  }
  const text = promptTokenText(value);
  if (caret > text.length) return null;
  const before = text.slice(runStart, caret);
  let best: PromptTokenMatch | null = null;
  for (const trigger of triggers) {
    if (!trigger) continue;
    let index = before.lastIndexOf(trigger);
    while (index >= 0) {
      const start = runStart + index;
      const boundary = start === 0 || /\s/.test(text[start - 1]!);
      const query = before.slice(index + trigger.length);
      if (boundary && !query.includes("\n") && (allowsSpaces || !/\s/.test(query))) {
        if (!best || start > best.start) best = { trigger, start, query };
        break;
      }
      index = index > 0 ? before.lastIndexOf(trigger, index - 1) : -1;
    }
  }
  return best;
}

/**
 * Insert a token for `match` (replacing the trigger and its query), with a trailing space unless one follows already
 * (`appendSpace`, default true). The caret lands after the token / space.
 */
export function insertPromptToken(
  value: PromptTokenValue,
  match: { start: number; trigger?: string },
  caret: number,
  token: { text: string; value?: string },
  appendSpace = true,
): PromptTokenEdit {
  const text = promptTokenText(value);
  const segment: PromptTokenSegment = { type: "token", text: token.text };
  if (token.value !== undefined) segment.value = token.value;
  if (match.trigger !== undefined) segment.trigger = match.trigger;
  const insert: PromptSegment[] = [segment];
  const next = text[caret];
  if (appendSpace && (next === undefined || !/\s/.test(next))) insert.push({ type: "text", text: " " });
  const edit = replacePromptTokens(value, match.start, caret, insert);
  // A space that already followed: step over it.
  if (appendSpace && next !== undefined && /\s/.test(next) && next !== "\n") edit.caret += 1;
  return edit;
}
