// Ported from yet-another-react-lightbox (src/types.ts, src/props.ts, src/consts.ts, src/utils.ts, v3.32.2), MIT,
// © Igor Danchenko.
// Rivet:
// - Lightbox state = plain data + signals (serializable: a resumed inline lightbox and a re-created overlay region keep it);
//   YARL's reducer (`swipe` / `update` actions) → `globalIndex` signal + the controllable `index`.
// - Slide types: YARL `image` + the Video plugin's `video`, plus Rivet `embed` (YouTube / Vimeo / any iframe) and `pdf`
//   (browser PDF viewer); custom types render through the carousel's render function (YARL `render.slide`).
// - Plugin UI state lives here as signals (captions / thumbnails visibility, slideshow playing, zoom level, fullscreen)
//   so plugin parts on a resumed page share it without a client-only registry. A signal costs nothing until read.
// - Durations stay in milliseconds (YARL API); the motion (`../motion`, embla physics) converts them: `msToMotion`.
// - Easing options (`animation.easing`) are not ported: every slide / zoom / pull animation is embla's ScrollBody (house
//   motion, user decision 2026-10-08); `animation.fade` is a CSS duration (`--rv-lightbox-fade`).
import { signal, untrack, type Signal } from "@rivetjs/reactivity";
import { controllable, setControlledValue, type ControlledState } from "../interactions/controllable.ts";
import type { OverlayTriggerState } from "../state/overlays.ts";

/* ------------------------------------------------------------------------------------------------
 * Slides
 * ----------------------------------------------------------------------------------------------*/

/** Image source of a responsive image slide (YARL `ImageSource`). */
export interface LightboxImageSource {
  /** Image URL. */
  src: string;
  /** Image width in pixels. */
  width: number;
  /** Image height in pixels. */
  height: number;
}

/** `object-fit` of image slides (YARL `ImageFit`). */
export type LightboxImageFit = "contain" | "cover";

/** Fields every slide type accepts (plugins read them). */
export interface LightboxSlideBase {
  /** Slide type (default `image`). */
  type?: string;
  /** Stable key (default: the image `src`); keeps the slide's DOM node when the slides array is replaced. */
  key?: string;
  /** Captions plugin: slide title. */
  title?: string;
  /** Captions plugin: slide description (plain text; new lines kept). */
  description?: string;
  /** Thumbnails plugin: thumbnail image URL. */
  thumbnail?: string;
  /** Download plugin: `false` = not downloadable, a URL, or `{ url, filename }`. */
  download?: boolean | string | { url: string; filename?: string };
  /** Download plugin: download URL (default: the image `src`). */
  downloadUrl?: string;
  /** Download plugin: file name. */
  downloadFilename?: string;
  /** Share plugin: `false` = not shareable, a URL, or `{ url, text, title }`. */
  share?: boolean | string | { url?: string; text?: string; title?: string };
}

/** Image slide (YARL `SlideImage`). */
export interface LightboxSlideImage extends LightboxSlideBase {
  type?: "image";
  /** Image URL. */
  src: string;
  /** `alt` text. */
  alt?: string;
  /** Image width in pixels. */
  width?: number;
  /** Image height in pixels. */
  height?: number;
  /** `object-fit` of this slide (overrides `carousel.imageFit`). */
  imageFit?: LightboxImageFit;
  /** Alternative images for `srcset`. */
  srcSet?: readonly LightboxImageSource[];
  /** Rivet: explicit `sizes` (default: computed from the slide box once measured, else `100vw`). */
  sizes?: string;
}

/** One `<source>` of a video slide (YARL Video plugin). */
export interface LightboxVideoSource {
  src: string;
  type: string;
  media?: string;
}

/** Video options shared by the Video plugin defaults and video slides (YARL `SlideVideo`). */
export interface LightboxVideoOptions {
  autoPlay?: boolean;
  controls?: boolean;
  controlsList?: string;
  crossOrigin?: string;
  preload?: string;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  disablePictureInPicture?: boolean;
  disableRemotePlayback?: boolean;
}

/** Video slide (YARL Video plugin `SlideVideo`). */
export interface LightboxSlideVideo extends LightboxSlideBase, LightboxVideoOptions {
  type: "video";
  /** Video files. */
  sources: readonly LightboxVideoSource[];
  /** Placeholder image. */
  poster?: string;
  /** Video width in pixels. */
  width?: number;
  /** Video height in pixels. */
  height?: number;
}

/** Embed slide (Rivet): an iframe mounted only while the slide is the current one. */
export interface LightboxSlideEmbed extends LightboxSlideBase {
  type: "embed";
  /** `youtube` (youtube-nocookie.com), `vimeo` (player.vimeo.com, `dnt=1`) or `iframe` (`src` as is). @default "iframe" */
  provider?: "youtube" | "vimeo" | "iframe";
  /** Video id (YouTube / Vimeo). */
  id?: string;
  /** iframe URL (`iframe` provider, or a full URL overriding the provider's). */
  src?: string;
  /** Accessible iframe title (required for a11y). */
  title: string;
  /** Frame width / height (aspect ratio). @default 1280 × 720 */
  width?: number;
  height?: number;
  /** Placeholder image shown until the slide is viewed (also the thumbnail). */
  poster?: string;
  /** Start time in seconds (YouTube / Vimeo). */
  start?: number;
  /** Autoplay once mounted (YouTube / Vimeo; browsers may require `muted`). */
  autoPlay?: boolean;
  /** Mute (YouTube / Vimeo). */
  muted?: boolean;
  /** iframe `allow`. @default "autoplay; fullscreen; picture-in-picture; encrypted-media" */
  allow?: string;
}

/** PDF slide (Rivet): the browser's built-in PDF viewer (`<object type="application/pdf">`) with a download fallback. */
export interface LightboxSlidePdf extends LightboxSlideBase {
  type: "pdf";
  /** PDF URL. */
  src: string;
  /** Accessible title. */
  title?: string;
  /** Page box width / height in pixels (aspect ratio). @default 1240 × 1754 (A4) */
  width?: number;
  height?: number;
}

/** A custom slide type (rendered by the carousel's render function). */
export interface LightboxSlideCustom extends LightboxSlideBase {
  type: string;
  [key: string]: unknown;
}

/** Any slide. */
export type LightboxSlide = LightboxSlideImage | LightboxSlideVideo | LightboxSlideEmbed | LightboxSlidePdf | LightboxSlideCustom;

/* ------------------------------------------------------------------------------------------------
 * Settings
 * ----------------------------------------------------------------------------------------------*/

/** Length or percentage (YARL `LengthOrPercentage`). */
export type LightboxLength = `${number}px` | `${number}%` | number;

/** Carousel settings (YARL `CarouselSettings`). */
export interface LightboxCarouselSettings {
  /** No wrap-around. @default false */
  finite: boolean;
  /** Slides rendered on each side of the current one (2 × preload + 1 in the DOM). @default 2 */
  preload: number;
  /** Padding around each slide. @default "16px" */
  padding: LightboxLength;
  /** Spacing between slides (percent of the carousel width). @default "30%" */
  spacing: LightboxLength;
  /** `object-fit` of image slides. @default "contain" */
  imageFit: LightboxImageFit;
}

/** Animation settings in milliseconds (YARL `AnimationSettings`; easing → embla physics). */
export interface LightboxAnimationSettings {
  /** Fade-in / fade-out duration (CSS, `--rv-lightbox-fade`, written only when given: unset = the stylesheet's timing; gestures use 250). @default 250 */
  fade: number;
  /** Swipe settle duration. @default 500 */
  swipe: number;
  /** Prev / next (keyboard, buttons) duration. @default `swipe` */
  navigation?: number;
  /** Zoom duration (Zoom plugin). @default 500 */
  zoom: number;
}

/** Controller settings (YARL `ControllerSettings`). */
export interface LightboxControllerSettings {
  /** Close on a pull-up gesture. @default false */
  closeOnPullUp: boolean;
  /** Close on a pull-down gesture. @default false */
  closeOnPullDown: boolean;
  /** Close when the backdrop (slide area outside the media) is clicked. @default false */
  closeOnBackdropClick: boolean;
  /** Close on Escape. @default true */
  closeOnEscape: boolean;
  /** Prevent default for horizontal wheel events. @default true */
  preventDefaultWheelX: boolean;
  /** Prevent default for vertical wheel events. @default false */
  preventDefaultWheelY: boolean;
  /** No slide change on pointer swipe / drag. @default false */
  disableSwipeNavigation: boolean;
  /** `touch-action` of the container. @default "none" */
  touchAction: "none" | "pan-y";
  /** Focus the container when the lightbox opens. @default true */
  focus: boolean;
}

/** UI labels (YARL `Labels` + plugin labels). */
export interface LightboxLabels {
  Previous?: string;
  Next?: string;
  Close?: string;
  Slide?: string;
  Carousel?: string;
  Lightbox?: string;
  "Photo gallery"?: string;
  /** Template: `{index}`, `{total}`. */
  "{index} of {total}"?: string;
  "Zoom in"?: string;
  "Zoom out"?: string;
  Download?: string;
  Share?: string;
  "Enter Fullscreen"?: string;
  "Exit Fullscreen"?: string;
  Play?: string;
  Pause?: string;
  "Show thumbnails"?: string;
  "Hide thumbnails"?: string;
  "Show captions"?: string;
  "Hide captions"?: string;
  /** PDF fallback text. */
  "Open PDF"?: string;
  /** Embed placeholder button. */
  "Play video"?: string;
  /** Thumbnail button; template `{index}`. */
  "Go to slide {index}"?: string;
}

export type LightboxLabel = keyof LightboxLabels;

/** YARL defaults (`LightboxDefaultProps`). */
export const LIGHTBOX_CAROUSEL_DEFAULTS: LightboxCarouselSettings = { finite: false, preload: 2, padding: "16px", spacing: "30%", imageFit: "contain" };
export const LIGHTBOX_ANIMATION_DEFAULTS: LightboxAnimationSettings = { fade: 250, swipe: 500, zoom: 500 };
export const LIGHTBOX_CONTROLLER_DEFAULTS: LightboxControllerSettings = {
  closeOnPullUp: false,
  closeOnPullDown: false,
  closeOnBackdropClick: false,
  closeOnEscape: true,
  preventDefaultWheelX: true,
  preventDefaultWheelY: false,
  disableSwipeNavigation: false,
  touchAction: "none",
  focus: true,
};

/* ------------------------------------------------------------------------------------------------
 * State
 * ----------------------------------------------------------------------------------------------*/

/** Lifecycle callbacks (YARL `on`). */
export interface LightboxCallbacks {
  /** A slide became active (also on open). */
  onView?: (props: { index: number }) => void;
  /** The current slide's media was clicked. */
  onClick?: (props: { index: number }) => void;
  /** The lightbox starts opening / has opened / starts closing / has closed (after the fade). */
  onEntering?: () => void;
  onEntered?: () => void;
  onExiting?: () => void;
  onExited?: () => void;
}

export interface LightboxStateProps extends LightboxCallbacks {
  /** Slides (plain data; an accessor / Signal for a live list). */
  slides?: readonly LightboxSlide[] | (() => readonly LightboxSlide[]);
  /** Current slide (controlled): a value, a two-way Signal or an accessor. */
  index?: number | Signal<number> | (() => number);
  /** Initial slide (uncontrolled). @default 0 */
  defaultIndex?: number;
  /** Called when the current slide changes. */
  onIndexChange?: (index: number) => void;
  carousel?: Partial<LightboxCarouselSettings>;
  animation?: Partial<LightboxAnimationSettings>;
  controller?: Partial<LightboxControllerSettings>;
  labels?: LightboxLabels;
}

export interface LightboxState {
  /** Element id prefix (`<id>-container`, `<id>-carousel`). */
  readonly id: string;
  /** Slides as given (array, Signal or accessor); read with `lightboxSlides(state)`. */
  readonly slides: readonly LightboxSlide[] | (() => readonly LightboxSlide[]) | undefined;
  /** Current slide index in `[0, n)` (controllable). */
  readonly index: ControlledState<number>;
  /** Current slide index in `(-∞, +∞)` (YARL `globalIndex`; keys the rendered slides). */
  readonly globalIndex: Signal<number>;
  readonly carousel: LightboxCarouselSettings;
  readonly animation: LightboxAnimationSettings;
  readonly controller: LightboxControllerSettings;
  readonly labels: LightboxLabels;
  readonly on: LightboxCallbacks;
  /** Whether the lightbox is shown inline (Inline plugin): no close, no focus grab. */
  readonly inline: boolean;
  /** The overlay open state (`undefined` inline). */
  readonly overlay: OverlayTriggerState | undefined;
  /** Zoom level of the current slide (Zoom plugin; 1 = none). Swipe / pull / arrow navigation stop while > 1. */
  readonly zoom: Signal<number>;
  /** Max zoom of the current slide (Zoom plugin; 1 = zoom disabled). */
  readonly maxZoom: Signal<number>;
  /** Slideshow playing (Slideshow plugin). */
  readonly playing: Signal<boolean>;
  /** Captions visible (Captions plugin; `undefined` until the part sets its default). */
  readonly captions: Signal<boolean | undefined>;
  /** Thumbnails visible (Thumbnails plugin). */
  readonly thumbnails: Signal<boolean | undefined>;
  /** Fullscreen active (Fullscreen plugin). */
  readonly fullscreen: Signal<boolean>;
  /** Swiping / pulling / animating: `swipe` | `pull` | `animation` | undefined (YARL `SwipeState`). */
  readonly gesture: Signal<"swipe" | "pull" | "animation" | undefined>;
}

const EMPTY: readonly LightboxSlide[] = [];

/** The slides of a lightbox (tracked when they are a Signal / accessor). */
export function lightboxSlides(state: LightboxState): readonly LightboxSlide[] {
  const slides = state.slides;
  return typeof slides === "function" ? slides() : (slides ?? EMPTY);
}

/** Creates a lightbox state (react-stately-style factory: serializable — no closures are created here). */
export function createLightboxState(props: LightboxStateProps, id: string, overlay?: OverlayTriggerState): LightboxState {
  const index = controllable<number>(props.index, props.defaultIndex ?? 0, props.onIndexChange);
  const start = untrack(index.value);
  return {
    id,
    slides: props.slides,
    index,
    globalIndex: signal(start),
    carousel: { ...LIGHTBOX_CAROUSEL_DEFAULTS, ...props.carousel },
    animation: { ...LIGHTBOX_ANIMATION_DEFAULTS, ...props.animation },
    controller: { ...LIGHTBOX_CONTROLLER_DEFAULTS, ...props.controller },
    labels: props.labels ?? {},
    on: {
      onView: props.onView,
      onClick: props.onClick,
      onEntering: props.onEntering,
      onEntered: props.onEntered,
      onExiting: props.onExiting,
      onExited: props.onExited,
    },
    inline: !overlay,
    overlay,
    zoom: signal(1),
    maxZoom: signal(1),
    playing: signal(false),
    captions: signal<boolean | undefined>(undefined),
    thumbnails: signal<boolean | undefined>(undefined),
    fullscreen: signal(false),
    gesture: signal<"swipe" | "pull" | "animation" | undefined>(undefined),
  };
}

/* ------------------------------------------------------------------------------------------------
 * Helpers (YARL utils.ts)
 * ----------------------------------------------------------------------------------------------*/

/** `index` wrapped into `[0, count)` (YARL `getSlideIndex`). */
export function getSlideIndex(index: number, count: number): number {
  return count > 0 ? ((index % count) + count) % count : 0;
}

/** Slide at a (possibly out-of-range) index (YARL `getSlide`). */
export function getSlide(slides: readonly LightboxSlide[], index: number): LightboxSlide | undefined {
  return slides[getSlideIndex(index, slides.length)];
}

/** Whether the slide is an image (YARL `isImageSlide`). */
export function isImageSlide(slide: LightboxSlide | undefined): slide is LightboxSlideImage {
  return !!slide && (slide.type === undefined || slide.type === "image");
}

/** Whether an image slide is rendered `object-fit: cover` (YARL `isImageFitCover`). */
export function isImageFitCover(image: LightboxSlideImage, imageFit?: LightboxImageFit): boolean {
  return image.imageFit === "cover" || (image.imageFit !== "contain" && imageFit === "cover");
}

/** Stable key of a slide (YARL `getSlideKey` + Rivet `key`). */
export function getSlideKey(slide: LightboxSlide): string | undefined {
  return slide.key ?? (isImageSlide(slide) ? slide.src : typeof (slide as { src?: unknown }).src === "string" ? (slide as { src: string }).src : undefined);
}

/** Number of slides rendered on each side (YARL `calculatePreload`). */
export function calculatePreload(carousel: Pick<LightboxCarouselSettings, "preload" | "finite">, count: number, minimum = 0): number {
  return Math.min(carousel.preload, Math.max(carousel.finite ? count - 1 : Math.floor(count / 2), minimum));
}

/** Parsed length (YARL `parseLengthPercentage`). */
export function parseLength(input: LightboxLength): { pixel?: number; percent?: number } {
  if (typeof input === "number") return { pixel: input };
  if (typeof input === "string") {
    const value = parseInt(input);
    return input.endsWith("%") ? { percent: value } : { pixel: value };
  }
  return { pixel: 0 };
}

/** Pixels of a length against `width` (percent lengths are relative to the carousel width). */
export function lengthPx(input: LightboxLength, width: number): number {
  const v = parseLength(input);
  return (v.percent !== undefined ? (width / 100) * v.percent : v.pixel) || 0;
}

/** Default labels (YARL English strings). */
const DEFAULT_LABELS: Required<LightboxLabels> = {
  Previous: "Previous",
  Next: "Next",
  Close: "Close",
  Slide: "slide",
  Carousel: "carousel",
  Lightbox: "Lightbox",
  "Photo gallery": "Photo gallery",
  "{index} of {total}": "{index} of {total}",
  "Zoom in": "Zoom in",
  "Zoom out": "Zoom out",
  Download: "Download",
  Share: "Share",
  "Enter Fullscreen": "Enter Fullscreen",
  "Exit Fullscreen": "Exit Fullscreen",
  Play: "Play",
  Pause: "Pause",
  "Show thumbnails": "Show thumbnails",
  "Hide thumbnails": "Hide thumbnails",
  "Show captions": "Show captions",
  "Hide captions": "Hide captions",
  "Open PDF": "Open PDF",
  "Play video": "Play video",
  "Go to slide {index}": "Go to slide {index}",
};

/** Translated label (YARL `translateLabel`). */
export function translateLabel(labels: LightboxLabels | undefined, label: LightboxLabel): string {
  return labels?.[label] ?? DEFAULT_LABELS[label];
}

/** "k of N" slide label (YARL `translateSlideCounter`). */
export function translateSlideCounter(labels: LightboxLabels | undefined, count: number, index: number): string {
  return translateLabel(labels, "{index} of {total}")
    .replace(/\{index}/g, `${getSlideIndex(index, count) + 1}`)
    .replace(/\{total}/g, `${count}`);
}

/** YARL milliseconds → embla ScrollBody duration (25 ≈ 500 ms to settle; 0 = instant). */
export function msToMotion(ms: number): number {
  return ms > 0 ? Math.max(1, ms / 20) : 0;
}

/** Rounds to `decimals` (YARL `round`). */
export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** One rendered carousel slot (YARL Carousel `items`). */
export interface LightboxWindowItem {
  /** Row key (global position + slide key). */
  key: string;
  /** Slide. */
  slide: LightboxSlide;
  /** Offset from the current slide (0 = current). */
  offset: number;
  /** Slide index in `[0, n)`. */
  index: number;
}

/** Slides rendered around the current one (YARL Carousel: 2 × preload + 1, finite placeholders dropped). */
export function lightboxWindow(state: LightboxState): LightboxWindowItem[] {
  const slides = lightboxSlides(state);
  const count = slides.length;
  if (count === 0) return [];
  const globalIndex = state.globalIndex();
  const current = getSlideIndex(globalIndex, count);
  const preload = calculatePreload(state.carousel, count, 1);
  const items: LightboxWindowItem[] = [];
  for (let i = current - preload; i <= current + preload; i += 1) {
    if (state.carousel.finite && (i < 0 || i > count - 1)) continue;
    const slide = slides[getSlideIndex(i, count)]!;
    const key = globalIndex - current + i;
    items.push({ key: [`${key}`, getSlideKey(slide)].filter(Boolean).join("|"), slide, offset: i - current, index: getSlideIndex(i, count) });
  }
  return items;
}

/** Current slide index (tracked). */
export const lightboxIndex = (state: LightboxState): number => getSlideIndex(state.globalIndex(), lightboxSlides(state).length);

/** Current slide (tracked). */
export const lightboxSlide = (state: LightboxState): LightboxSlide | undefined => getSlide(lightboxSlides(state), state.globalIndex());

/** Whether Previous / Next are disabled (YARL `useNavigationState`). */
export function lightboxNavigation(state: LightboxState): { prevDisabled: boolean; nextDisabled: boolean } {
  const count = lightboxSlides(state).length;
  const current = lightboxIndex(state);
  return {
    prevDisabled: count === 0 || (state.carousel.finite && current === 0),
    nextDisabled: count === 0 || (state.carousel.finite && current === count - 1),
  };
}

/** Moves the current slide by `increment` without animation bookkeeping (the controller animates). */
export function setLightboxGlobalIndex(state: LightboxState, globalIndex: number): void {
  state.globalIndex.set(globalIndex);
  const next = getSlideIndex(globalIndex, untrack(() => lightboxSlides(state)).length);
  if (untrack(state.index.value) !== next) setControlledValue(state.index, next);
}
