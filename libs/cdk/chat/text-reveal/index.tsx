// Keep character pacing out of shared composer/attachment chunks.
import { effect, untrack, type Signal } from "@rivetjs/reactivity";

let graphemeSegmenter: Intl.Segmenter | undefined;

/** Visible characters, keeping emoji sequences and combining marks together. */
export function textGraphemes(text: string): string[] {
  return Array.from((graphemeSegmenter ??= new Intl.Segmenter(undefined, { granularity: "grapheme" })).segment(text), (part) => part.segment);
}

export interface TextRevealOptions {
  /** Input is being generated. Once false, pending characters still finish revealing. */
  isStreaming?: () => boolean;
  /** Graphemes per second; 0 displays immediately. @default 80 */
  speed?: number;
  /** Whether there are characters waiting to be displayed. */
  onRevealingChange?: (revealing: boolean) => void;
}

/**
 * Pace appended source text into a display signal, independent of network chunk size. Initial text is preserved;
 * replacements are immediate. Bursts catch up within 240ms; reduced motion bypasses pacing. Browser only: install
 * from a clientEffect and return its disposer. No timers run when the queue is empty.
 */
export function followText(source: () => string, target: Signal<string>, options: TextRevealOptions = {}): () => void {
  const media = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : undefined;
  const speed = options.speed ?? 80;
  let previous = untrack(source);
  let wasStreaming = false;
  let pending: string[] = [];
  let frame = 0;
  let last = 0;
  let credit = 0;
  let rate = speed;
  let revealing = false;
  const setRevealing = (value: boolean): void => {
    if (revealing === value) return;
    revealing = value;
    untrack(() => options.onRevealingChange?.(value));
  };
  const clear = (): void => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    pending = [];
    credit = 0;
    setRevealing(false);
  };
  const immediate = (): void => {
    clear();
    target.set(previous);
  };
  const step = (now: number): void => {
    frame = 0;
    credit += (Math.max(0, now - last) * rate) / 1000;
    last = now;
    const count = Math.min(pending.length, Math.floor(credit));
    if (count) {
      target.set(untrack(target) + pending.splice(0, count).join(""));
      credit -= count;
    }
    if (pending.length) frame = requestAnimationFrame(step);
    else {
      credit = 0;
      setRevealing(false);
    }
  };
  const dispose = effect(() => {
    const next = source();
    const streaming = options.isStreaming?.() ?? true;
    const animate = streaming || wasStreaming || revealing;
    wasStreaming = streaming;
    const appended = next.startsWith(previous);
    previous = next;
    if (!animate || !appended || !Number.isFinite(speed) || speed <= 0 || media?.matches || typeof requestAnimationFrame !== "function") {
      immediate();
      return;
    }
    // A UTF-16 transport chunk can end between the two halves of a surrogate pair.
    const available = next.replace(/[\uD800-\uDBFF]$/, "");
    pending = textGraphemes(available.slice(untrack(target).length));
    rate = Math.max(speed, pending.length / 0.24);
    if (!pending.length) return;
    setRevealing(true);
    if (!frame) {
      last = performance.now();
      frame = requestAnimationFrame(step);
    }
  });
  const motionChanged = (): void => {
    if (media?.matches) immediate();
  };
  media?.addEventListener("change", motionChanged);
  return () => {
    dispose();
    media?.removeEventListener("change", motionChanged);
    clear();
  };
}
