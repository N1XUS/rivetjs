// Rivet carousel state (no upstream file): the serializable mirror of an embla engine (`./engine/`) for the
// component layer (`./index.tsx`) — plain signals + JSON, so a resumed page reads the server's values until the
// engine starts (`./behaviour.tsx`), then the engine's events write them.
// Server values (no layout yet): one snap per `slidesToScroll` group of the known slides, `startIndex` selected,
// `canScrollPrev` / `canScrollNext` from the index (always with `loop`), every slide of the selected group
// "snapped", none "in view"; `isPlaying` = autoplay / auto scroll with `playOnInit` (default) on.
import { signal, _regionState, type Signal } from "@rivetjs/reactivity";
import type { EmblaOptionsType } from "./engine/Options.ts";
import type { EmblaCarouselType } from "./engine/EmblaCarousel.ts";
import type { EmblaPluginType } from "./engine/Plugins.ts";
import type { AutoplayOptionsType } from "./plugins/autoplay/Autoplay.ts";
import type { AutoScrollOptionsType } from "./plugins/auto-scroll/AutoScroll.ts";

/** Engine options the component layer forwards (embla `EmblaOptionsType` minus `container` / `slides`: the parts are the DOM). */
export type CarouselOptions = Omit<EmblaOptionsType, "container" | "slides">;

export interface CarouselStateOptions extends CarouselOptions {
  /** Unique id prefix of the parts (`<id>-viewport`, `<id>-slide-<i>`, `<id>-tab-<i>`). */
  id: string;
  /** Known number of slides (static children: counted while rendering; `CarouselContainer items`: their length). */
  slideCount?: number;
  /** Autoplay plugin (`./plugins/autoplay`): `true` or its options. */
  autoplay?: boolean | AutoplayOptionsType;
  /** AutoScroll plugin (`./plugins/auto-scroll`): `true` or its options. */
  autoScroll?: boolean | AutoScrollOptionsType;
  /** Extra plugins, created when the engine starts (an inline arrow: resumable). On a resumed page the engine then starts when the carousel is visible. */
  plugins?: () => EmblaPluginType[];
  /** Called with the engine API when it starts (`setApi` in shadcn terms): `api.on(…)`, `api.scrollTo(…)`. On a resumed page the engine then starts when the carousel is visible. */
  onApi?: (api: EmblaCarouselType) => void;
  /** Called when the selected snap changes (embla `select`). */
  onSelect?: (index: number) => void;
  /** Called when the carousel settles (embla `settle`). */
  onSettle?: (index: number) => void;
}

export interface CarouselState {
  id: string;
  /** Engine options (plain data; function options must be inline arrows). */
  options: CarouselOptions;
  autoplay: false | AutoplayOptionsType;
  autoScroll: false | AutoScrollOptionsType;
  plugins?: () => EmblaPluginType[];
  onApi?: (api: EmblaCarouselType) => void;
  onSelect?: (index: number) => void;
  onSettle?: (index: number) => void;
  /** Selected snap (embla `selectedScrollSnap()`). */
  selectedIndex: Signal<number>;
  /** Previously selected snap (embla `previousScrollSnap()`). */
  previousIndex: Signal<number>;
  /** Number of snaps (embla `scrollSnapList().length`). */
  snapCount: Signal<number>;
  /** Number of slides (embla `slideNodes().length`); 0 = not known yet. */
  slideCount: Signal<number>;
  /** Slide indexes per snap (embla `internalEngine().slideRegistry`). */
  slideRegistry: Signal<number[][]>;
  canScrollPrev: Signal<boolean>;
  canScrollNext: Signal<boolean>;
  /** Slides in view (embla `slidesInView()`; `[]` until the engine's IntersectionObserver reports). */
  slidesInView: Signal<number[]>;
  /** Scroll progress 0–1 (embla `scrollProgress()`, written on `scroll`). */
  scrollProgress: Signal<number>;
  /** Pointer down on the viewport (embla `pointerDown` → `pointerUp`). */
  isDragging: Signal<boolean>;
  /** Autoplay / auto scroll running (`autoplay:play` / `autoplay:stop`, `autoScroll:play` / `autoScroll:stop`). */
  isPlaying: Signal<boolean>;
  /**
   * Rotation stopped (rotation control, keyboard focus: W3C APG; initially when `playOnInit` is off) — the plugins
   * are removed until started again. A hover pause does not set it.
   */
  isRotationStopped: Signal<boolean>;
  /** The engine runs (layout measured). */
  isReady: Signal<boolean>;
  /** Render-time slide counter (server / client render order → slide index). */
  refs: { count: number };
}

const groupsOf = (count: number, size: number): number[][] => {
  const groups: number[][] = [];
  for (let i = 0; i < count; i += size) groups.push(Array.from({ length: Math.min(size, count - i) }, (_, j) => i + j));
  return groups;
};

/** Snap groups the server assumes before layout (numeric `slidesToScroll`; `"auto"` = 1 per snap). */
export function estimateRegistry(count: number, slidesToScroll: CarouselOptions["slidesToScroll"]): number[][] {
  return groupsOf(count, typeof slidesToScroll === "number" && slidesToScroll > 0 ? slidesToScroll : 1);
}

export function createCarouselState(options: CarouselStateOptions): CarouselState {
  const { id, slideCount = 0, autoplay, autoScroll, plugins, onApi, onSelect, onSettle, ...engine } = options;
  const registry = estimateRegistry(slideCount, engine.slidesToScroll);
  const snaps = Math.max(registry.length, 1);
  const start = Math.min(Math.max(engine.startIndex ?? 0, 0), snaps - 1);
  const loop = !!engine.loop;
  const playOnInit = (o: boolean | { playOnInit?: boolean } | undefined) => !!o && (o === true || o.playOnInit !== false);
  return {
    id,
    options: engine,
    autoplay: autoplay ? (autoplay === true ? {} : autoplay) : false,
    autoScroll: autoScroll ? (autoScroll === true ? {} : autoScroll) : false,
    plugins,
    onApi,
    onSelect,
    onSettle,
    selectedIndex: _regionState(() => signal(start)),
    previousIndex: _regionState(() => signal(start)),
    snapCount: _regionState(() => signal(snaps)),
    slideCount: _regionState(() => signal(slideCount)),
    slideRegistry: _regionState(() => signal(registry)),
    canScrollPrev: _regionState(() => signal(snaps > 1 && (loop || start > 0))),
    canScrollNext: _regionState(() => signal(snaps > 1 && (loop || start < snaps - 1))),
    slidesInView: _regionState(() => signal<number[]>([])),
    scrollProgress: _regionState(() => signal(0)),
    isDragging: _regionState(() => signal(false)),
    isPlaying: _regionState(() => signal(playOnInit(autoplay) || playOnInit(autoScroll))),
    isRotationStopped: _regionState(() => signal(!!(autoplay || autoScroll) && !playOnInit(autoplay) && !playOnInit(autoScroll))),
    isReady: _regionState(() => signal(false)),
    refs: { count: 0 },
  };
}

/** Whether slide `index` belongs to the selected snap (embla ClassNames `is-snapped`). */
export function isSlideSnapped(state: CarouselState, index: number): boolean {
  const group = state.slideRegistry()[state.selectedIndex()];
  return !!group && group.includes(index);
}

/** Whether slide `index` is in view (embla ClassNames `is-in-view`). */
export function isSlideInView(state: CarouselState, index: number): boolean {
  return state.slidesInView().includes(index);
}

/** Snap that shows slide `index` (embla `slideRegistry` lookup, as SlideFocus does). */
export function snapOfSlide(state: CarouselState, index: number): number {
  const snap = state.slideRegistry().findIndex((group) => group.includes(index));
  return snap < 0 ? 0 : snap;
}

/** Whether rotation is on: a rotation plugin is configured and not stopped (a hover pause keeps it on). */
export function isRotating(state: CarouselState): boolean {
  return hasRotation(state) && !state.isRotationStopped();
}

/** Whether an autoplay or auto-scroll plugin is configured. */
export function hasRotation(state: CarouselState): boolean {
  return !!state.autoplay || !!state.autoScroll;
}
