// Ported from yet-another-react-lightbox (src/plugins/slideshow/{Slideshow.tsx,SlideshowButton.tsx,
// SlideshowContext.tsx,props.ts}, v3.32.2), MIT, © Igor Danchenko.
// Rivet:
// - `<LightboxSlideshow>` play / pause button part (YARL SlideshowButton) + free functions `lightboxPlay` /
//   `lightboxPause` (YARL `slideshow.ref`); playing state = `state.playing` (resumable; the carousel sets
//   `aria-live="off"` while playing, APG rotation).
// - Wait rule = YARL's: the next slide is scheduled `delay` ms after the current slide is ready — an image that is still
//   loading, or a video that is playing, holds the slideshow until it loads / ends (YARL slide status events; here read
//   from the current slide's DOM: `img.complete`, `video.paused` / `ended`). A finite carousel stops at the last slide.
// - Timers live in a WeakMap keyed by the state (never serialized); the `rv-lightbox-view` event (core, after every
//   slide change) reschedules. `autoplay` starts when the part mounts (an inline lightbox with `autoplay` runs at load).
import { onCleanup, untrack } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { StyleObject } from "@rivetjs/runtime/style";
import { lightboxContainer, lightboxNext } from "../behaviour.ts";
import { LightboxButton, lightboxToggleContent, useLightbox, type LightboxToggleChildren } from "../index.tsx";
import { getSlideIndex, lightboxSlides, translateLabel, type LightboxState } from "../state.ts";

interface Runner {
  delay: number;
  timer: ReturnType<typeof setTimeout> | undefined;
  wait: (() => void) | undefined;
  container: HTMLElement | null;
  onView: () => void;
  onStart?: () => void;
  onStop?: () => void;
}

const runners = new WeakMap<LightboxState, Runner>();

const atEnd = (state: LightboxState): boolean => {
  const count = lightboxSlides(state).length;
  return state.carousel.finite && getSlideIndex(state.globalIndex(), count) >= count - 1;
};

function clear(r: Runner): void {
  clearTimeout(r.timer);
  r.timer = undefined;
  r.wait?.();
  r.wait = undefined;
}

function schedule(state: LightboxState, r: Runner): void {
  clear(r);
  if (!untrack(state.playing)) return;
  if (untrack(() => atEnd(state))) {
    lightboxPause(state);
    return;
  }
  const slide = lightboxContainer(state)?.querySelector("[data-lightbox-slide][data-current]");
  const img = slide?.querySelector("img");
  const video = slide?.querySelector("video");
  const hold = (el: Element, events: string[]) => {
    const go = () => schedule(state, r);
    for (const e of events) el.addEventListener(e, go, { once: true });
    r.wait = () => {
      for (const e of events) el.removeEventListener(e, go);
    };
  };
  if (video && !video.paused && !video.ended) hold(video, ["ended", "pause"]);
  else if (img && !img.complete) hold(img, ["load", "error"]);
  else
    r.timer = setTimeout(() => {
      r.timer = undefined;
      if (untrack(state.playing)) lightboxNext(state);
    }, r.delay);
}

/** Starts the slideshow (YARL `slideshow.ref.play`). */
export function lightboxPlay(state: LightboxState): void {
  const r = runners.get(state);
  if (!r || untrack(state.playing) || untrack(() => atEnd(state))) return;
  r.container = lightboxContainer(state);
  r.container?.addEventListener("rv-lightbox-view", r.onView);
  state.playing.set(true);
  r.onStart?.();
  schedule(state, r);
}

/** Stops the slideshow (YARL `slideshow.ref.pause`). */
export function lightboxPause(state: LightboxState): void {
  const r = runners.get(state);
  if (!untrack(state.playing)) return;
  state.playing.set(false);
  if (!r) return;
  clear(r);
  r.container?.removeEventListener("rv-lightbox-view", r.onView);
  r.container = null;
  r.onStop?.();
}

function runner(state: LightboxState, delay: number, onStart?: () => void, onStop?: () => void): Runner {
  let r = runners.get(state);
  if (!r) {
    const created: Runner = { delay, timer: undefined, wait: undefined, container: null, onView: () => schedule(state, created), onStart, onStop };
    runners.set(state, created);
    r = created;
  }
  r.delay = delay;
  r.onStart = onStart;
  r.onStop = onStop;
  return r;
}

export interface LightboxSlideshowProps {
  class?: string;
  style?: StyleObject;
  /** Label override (default "Play" / "Pause"). */
  label?: string;
  /** Icon: content, or a function of the playing state. */
  children?: LightboxToggleChildren;
  /** Start playing when the part mounts. @default false */
  autoplay?: boolean;
  /** Delay between slides (ms). @default 3000 */
  delay?: number;
  /** YARL `on.slideshowStart` / `on.slideshowStop`. */
  onStart?: () => void;
  onStop?: () => void;
}

/** Play / pause button (YARL `SlideshowButton`); disabled on the last slide of a finite carousel. */
export function LightboxSlideshow(props: LightboxSlideshowProps) {
  const state = useLightbox();
  const label = props.label,
    children = props.children,
    autoplay = props.autoplay ?? false,
    delay = props.delay ?? 3000,
    onStart = props.onStart,
    onStop = props.onStop;
  if (autoplay)
    clientEffect(() =>
      untrack(() => {
        runner(state, delay, onStart, onStop);
        lightboxPlay(state);
      }),
    );
  onCleanup(() => {
    if (typeof document !== "undefined") lightboxPause(state);
  });
  const on = () => state.playing();
  return (
    <LightboxButton
      class={props.class}
      style={props.style}
      action="slideshow"
      pressed={on}
      isDisabled={() => !state.playing() && atEnd(state)}
      label={() => label ?? translateLabel(state.labels, state.playing() ? "Pause" : "Play")}
      onPress={() => {
        runner(state, delay, onStart, onStop);
        if (untrack(state.playing)) lightboxPause(state);
        else lightboxPlay(state);
      }}
    >
      {lightboxToggleContent(children, on)}
    </LightboxButton>
  );
}
