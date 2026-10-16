// Rivet carousel behaviour (no upstream hook; embla is framework-free): starts / stops the embla engine
// (`./engine/`) under the parts of `./index.tsx`, mirrors its events into the serializable `CarouselState`
// (`./state.ts`), and holds the handlers the parts bind (prev / next / dots / keys / focus / rotation control).
// `.tsx` (no JSX): `.ts` modules are not server-rewritten, and the parts' resumable closures call into this module.
// Engine lifecycle:
// - client render: the Carousel's `clientEffect` starts the engine after mount (embla `EmblaCarousel(viewport, …)`),
//   its cleanup destroys it;
// - resumed page: no code before interaction — the first pointer down / key / focus / press on the carousel starts
//   the engine synchronously in its handler (`ensureCarousel`); with autoplay / auto scroll the Carousel records a
//   `clientEffect({ when: "visible" })` that starts it when the viewport scrolls into view (documented preload);
// - the first `mousedown` / `touchstart` of a cold page is replayed after its chunk loaded, when the viewport
//   listener embla adds in `init` no longer sees it: `carouselDragStart` hands it to the engine
//   (`DragHandler.pointerDownEvent`, Rivet addition) and, for the mouse, releases the drag if the button is already up.
// Engines live in a module WeakMap keyed by the viewport element (found by id: resumed handlers capture no elements).
// Rotation (W3C APG carousel): hover pauses (embla Autoplay `stopOnMouseEnter`, resumes on leave), keyboard focus in
// the carousel or the rotation control stops it until the user starts it again (`isRotationStopped`; the rotation
// plugins are removed with `reInit`, so a later `mouseleave` cannot restart them). Autoplay / AutoScroll load with a
// dynamic `import()` the first time a carousel uses them (0 B otherwise).
import { batch, untrack } from "@rivetjs/reactivity";
import EmblaCarousel, { type EmblaCarouselType } from "./engine/EmblaCarousel.ts";
import type { EmblaPluginType } from "./engine/Plugins.ts";
import type { EmblaEventType } from "./engine/EventHandler.ts";
import type { OptionsType } from "./engine/Options.ts";
import { snapOfSlide, type CarouselState } from "./state.ts";

type PluginModules = {
  Autoplay?: typeof import("./plugins/autoplay/Autoplay.ts").default;
  AutoScroll?: typeof import("./plugins/auto-scroll/AutoScroll.ts").default;
};

const engines = new WeakMap<Element, EmblaCarouselType>();
const modules: PluginModules = {};
let loading: Promise<void> | undefined;

/** Id of the viewport element (embla root). */
export const carouselViewportId = (state: CarouselState): string => `${state.id}-viewport`;
/** Id of slide `index`. */
export const carouselSlideId = (state: CarouselState, index: number): string => `${state.id}-slide-${index}`;
/** Id of the tab (dot) of snap `index`. */
export const carouselTabId = (state: CarouselState, index: number): string => `${state.id}-tab-${index}`;

function viewportOf(state: CarouselState): HTMLElement | null {
  // `globalThis.document`: the compiler rejects bare browser globals in a server-rendered `.tsx` module (RV2001).
  const doc = (globalThis as { document?: Document }).document;
  return doc ? doc.getElementById(carouselViewportId(state)) : null;
}

/** The running engine of the carousel, if started. */
export function carouselApi(state: CarouselState): EmblaCarouselType | undefined {
  const viewport = viewportOf(state);
  return viewport ? engines.get(viewport) : undefined;
}

function needsRotationModules(state: CarouselState): boolean {
  return (!!state.autoplay && !modules.Autoplay) || (!!state.autoScroll && !modules.AutoScroll);
}

function loadRotationModules(state: CarouselState): Promise<void> {
  if (!needsRotationModules(state)) return Promise.resolve();
  return (loading ??= Promise.all([
    state.autoplay ? import("./plugins/autoplay/Autoplay.ts").then((m) => (modules.Autoplay = m.default)) : undefined,
    state.autoScroll ? import("./plugins/auto-scroll/AutoScroll.ts").then((m) => (modules.AutoScroll = m.default)) : undefined,
  ]).then(() => {
    loading = undefined;
  }));
}

/** The `Carousel` root around an engine root (viewport): rotation plugins' hover target. */
const carouselRoot = (viewport: HTMLElement): HTMLElement => (viewport.closest('[aria-roledescription="carousel"]') as HTMLElement | null) ?? viewport;

/** The plugin list for (re)starting the engine: rotation plugins (unless stopped, once loaded) + `plugins()`. */
function pluginList(state: CarouselState, withRotation: boolean): EmblaPluginType[] {
  const list: EmblaPluginType[] = [];
  // W3C APG: hover pauses rotation and leaving resumes it (embla `stopOnMouseEnter` + `stopOnInteraction: false`);
  // keyboard focus is handled here (`carouselFocusIn` → `stopRotation`), not by the plugin's `stopOnFocusIn`.
  // Hover target = the whole carousel (slides + controls), not only the engine root (the viewport).
  const apg = { stopOnMouseEnter: true, stopOnInteraction: false, stopOnFocusIn: false, rootNode: carouselRoot };
  if (withRotation && state.autoplay && modules.Autoplay) list.push(modules.Autoplay({ ...apg, ...state.autoplay }) as EmblaPluginType);
  if (withRotation && state.autoScroll && modules.AutoScroll) list.push(modules.AutoScroll({ ...apg, ...state.autoScroll }) as EmblaPluginType);
  if (state.plugins) list.push(...state.plugins());
  return list;
}

function engineOptions(state: CarouselState): Partial<OptionsType> {
  return { ...state.options };
}

/** Writes the engine's state into the carousel signals (embla `select` / `reInit` / `init`). */
function sync(state: CarouselState, api: EmblaCarouselType): void {
  batch(() => {
    state.selectedIndex.set(api.selectedScrollSnap());
    state.previousIndex.set(api.previousScrollSnap());
    state.snapCount.set(api.scrollSnapList().length);
    state.slideCount.set(api.slideNodes().length);
    state.slideRegistry.set(api.internalEngine().slideRegistry.map((group) => group.slice()));
    state.canScrollPrev.set(api.canScrollPrev());
    state.canScrollNext.set(api.canScrollNext());
    state.scrollProgress.set(api.scrollProgress());
    // `plugins()` is undefined while the engine is inactive (`active: false`, also per breakpoint: embla sets it in `activate`).
    const plugins = (api.plugins() ?? {}) as Record<string, { isPlaying?: () => boolean } | undefined>;
    state.isPlaying.set(!!plugins.autoplay?.isPlaying?.() || !!plugins.autoScroll?.isPlaying?.());
  });
}

/** `prefers-reduced-motion: reduce`, read at each motion step (live: a media change applies to the next one). */
function prefersReducedMotion(): boolean {
  const media = (globalThis as { matchMedia?: (query: string) => MediaQueryList }).matchMedia;
  return !!media && media("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Rivet deviation (embla has no reduced-motion handling): under `prefers-reduced-motion: reduce` every engine-driven
 * movement lands at once — the scroll body's duration becomes 0 (embla's own "jump"), so the next frame places the
 * track on its target. Covers prev / next / dots / keys / autoplay (`select`), the drag release (`pointerUp`, after
 * the release force picked the target, so dragFree keeps its landing point) and anything else that animates while
 * no pointer is down (`scroll`: edge bounce-back, AutoScroll is left alone — its speed is the content).
 * While the pointer is down the track still follows it.
 */
function reduceMotion(api: EmblaCarouselType): void {
  if (!prefersReducedMotion()) return;
  const engine = api.internalEngine();
  if (engine.dragHandler.pointerDown() || !engine.scrollBody.duration()) return;
  const plugins = (api.plugins() ?? {}) as Record<string, { isPlaying?: () => boolean } | undefined>;
  if (plugins.autoScroll?.isPlaying?.()) return;
  engine.scrollBody.useDuration(0);
}

function connect(state: CarouselState, api: EmblaCarouselType): void {
  const on = (type: string, listener: () => void) => api.on(type as EmblaEventType, listener);
  on("select", () => {
    reduceMotion(api);
    sync(state, api);
    state.onSelect?.(api.selectedScrollSnap());
  });
  on("reInit", () => sync(state, api));
  on("slidesInView", () => state.slidesInView.set(api.slidesInView().slice()));
  on("pointerDown", () => state.isDragging.set(true));
  on("pointerUp", () => {
    reduceMotion(api);
    state.isDragging.set(false);
  });
  on("scroll", () => {
    reduceMotion(api);
    state.scrollProgress.set(api.scrollProgress());
  });
  on("settle", () => {
    state.scrollProgress.set(api.scrollProgress());
    state.onSettle?.(api.selectedScrollSnap());
  });
  for (const type of ["autoplay:play", "autoScroll:play"]) on(type, () => state.isPlaying.set(true));
  for (const type of ["autoplay:stop", "autoScroll:stop"]) on(type, () => state.isPlaying.set(false));
  on("destroy", () => {
    batch(() => {
      state.isReady.set(false);
      state.isDragging.set(false);
      state.isPlaying.set(false);
    });
  });
}

/** Starts the engine on `viewport` (no-op when it runs). Rotation plugins join once their modules loaded. */
export function startCarousel(state: CarouselState, viewport: HTMLElement): EmblaCarouselType {
  const running = engines.get(viewport);
  if (running) return running;
  return untrack(() => {
    const rotate = !state.isRotationStopped();
    // The server offset of `startIndex` (`CarouselContainer` `translate`) must go before embla measures: a translated
    // container becomes its slides' offsetParent (embla `NodeRects` reads `offsetLeft` / `offsetTop`).
    const container = viewport.firstElementChild as HTMLElement | null;
    if (container) container.style.translate = "";
    const api = EmblaCarousel(viewport, engineOptions(state), pluginList(state, rotate));
    engines.set(viewport, api);
    connect(state, api);
    batch(() => {
      sync(state, api);
      state.isReady.set(true);
    });
    if (rotate && needsRotationModules(state))
      void loadRotationModules(state).then(() => {
        if (engines.get(viewport) === api && !untrack(state.isRotationStopped)) api.reInit(undefined, pluginList(state, true));
      });
    state.onApi?.(api);
    return api;
  });
}

/** Destroys the engine on `viewport` (embla `destroy`: transforms cleared, listeners removed). */
export function stopCarousel(viewport: HTMLElement): void {
  const api = engines.get(viewport);
  if (!api) return;
  engines.delete(viewport);
  api.destroy();
}

/** The running engine, started now when it was not (handlers on a resumed page). Undefined on the server / without a viewport. */
export function ensureCarousel(state: CarouselState): EmblaCarouselType | undefined {
  const viewport = viewportOf(state);
  if (!viewport) return undefined;
  return engines.get(viewport) ?? startCarousel(state, viewport);
}

/** Effect body of the Carousel's `clientEffect`: start on the viewport, destroy on cleanup. */
export function carouselEffect(state: CarouselState, viewport: HTMLElement | undefined): (() => void) | undefined {
  if (!viewport) return undefined;
  startCarousel(state, viewport);
  if (needsRotationModules(state)) void loadRotationModules(state);
  return () => stopCarousel(viewport);
}

// --- Commands (embla API through the state) ---

/** embla `scrollPrev(jump)`. */
export function carouselScrollPrev(state: CarouselState, jump?: boolean): void {
  ensureCarousel(state)?.scrollPrev(jump);
}

/** embla `scrollNext(jump)`. */
export function carouselScrollNext(state: CarouselState, jump?: boolean): void {
  ensureCarousel(state)?.scrollNext(jump);
}

/** embla `scrollTo(index, jump)`. */
export function carouselScrollTo(state: CarouselState, index: number, jump?: boolean): void {
  ensureCarousel(state)?.scrollTo(index, jump);
}

/** Stops rotation (rotation control, keyboard focus): plugins stopped and removed until `startRotation`. */
export function stopRotation(state: CarouselState): void {
  const api = carouselApi(state);
  batch(() => {
    state.isRotationStopped.set(true);
    state.isPlaying.set(false);
  });
  if (!api) return;
  const plugins = (api.plugins() ?? {}) as Record<string, { stop?: () => void } | undefined>;
  plugins.autoplay?.stop?.();
  plugins.autoScroll?.stop?.();
  api.reInit(undefined, pluginList(state, false));
}

/** Starts rotation again (rotation control): rotation plugins added back and played. */
export function startRotation(state: CarouselState): void {
  state.isRotationStopped.set(false);
  const api = ensureCarousel(state);
  if (!api) return;
  const play = () => {
    if (carouselApi(state) !== api || untrack(state.isRotationStopped)) return;
    api.reInit(undefined, pluginList(state, true));
    const plugins = (api.plugins() ?? {}) as Record<string, { play?: () => void } | undefined>;
    plugins.autoplay?.play?.();
    plugins.autoScroll?.play?.();
  };
  if (needsRotationModules(state)) void loadRotationModules(state).then(play);
  else play();
}

/** Rotation control press: stop when rotation is on (also while a hover pauses it), else start. */
export function toggleRotation(state: CarouselState): void {
  if (untrack(state.isRotationStopped)) startRotation(state);
  else stopRotation(state);
}

// --- Handlers ---

const EDITABLE = "input, textarea, select, [contenteditable]:not([contenteditable='false']), [role='slider'], [role='spinbutton']";

/** Keys of the carousel root, `data-rk` (held while a cold handler loads). */
export function carouselKeys(state: CarouselState): string {
  return state.options.axis === "y" ? "ArrowUp ArrowDown" : "ArrowLeft ArrowRight";
}

/** Root keydown: arrows scroll to the previous / next snap (RTL mirrored; vertical: up / down). Not in editable fields / the tab list. */
export function carouselKeyDown(event: KeyboardEvent, state: CarouselState): void {
  // A cold key replayed after its chunk loaded (`eventPhase` 0) was `preventDefault`ed by the loader's `data-rk`
  // hold, not by an inner widget: only a live event's `defaultPrevented` means "handled".
  if ((event.defaultPrevented && event.eventPhase !== 0) || event.altKey || event.ctrlKey || event.metaKey) return;
  const target = event.target as Element | null;
  if (target?.closest?.(EDITABLE) || target?.closest?.("[role='tablist']")) return;
  const vertical = state.options.axis === "y";
  const rtl = !vertical && state.options.direction === "rtl";
  const prev = vertical ? "ArrowUp" : rtl ? "ArrowRight" : "ArrowLeft";
  const next = vertical ? "ArrowDown" : rtl ? "ArrowLeft" : "ArrowRight";
  if (event.key !== prev && event.key !== next) return;
  event.preventDefault();
  if (event.key === prev) carouselScrollPrev(state);
  else carouselScrollNext(state);
}

/**
 * Root focusin: keyboard focus stops rotation (W3C APG); starts the engine; when it starts here and the focus
 * landed in a slide, scrolls to that slide's snap at once (embla SlideFocus, whose listener could not see this focus).
 */
export function carouselFocusIn(event: FocusEvent, state: CarouselState): void {
  const target = event.target as Element | null;
  const keyboard = !!target && typeof target.matches === "function" && safeMatches(target, ":focus-visible");
  if (keyboard && (state.autoplay || state.autoScroll) && !untrack(state.isRotationStopped)) stopRotation(state);
  const started = !!carouselApi(state);
  const api = ensureCarousel(state);
  if (started || !api || !target || api.internalEngine().options.watchFocus === false) return;
  const index = api.slideNodes().findIndex((slide) => slide.contains(target));
  if (index < 0) return;
  api.rootNode().scrollLeft = 0;
  api.scrollTo(snapOfSlide(state, index), true);
}

function safeMatches(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

/** Viewport pointerdown: starts the engine before the `mousedown` / `touchstart` embla listens to. */
export function carouselPointerDown(_event: PointerEvent, state: CarouselState): void {
  ensureCarousel(state);
}

/**
 * Viewport mousedown / touchstart: when the event's dispatch is over (`eventPhase` 0 — a cold page replays it after
 * its chunk loaded), the engine's own listener missed it: hand it over (embla `downIfAllowed`).
 */
export function carouselDragStart(event: MouseEvent | TouchEvent, state: CarouselState): void {
  if (event.eventPhase !== 0) return;
  const api = ensureCarousel(state);
  if (!api) return;
  api.internalEngine().dragHandler.pointerDownEvent(event);
  if (!("buttons" in event) || !api.internalEngine().dragHandler.pointerDown()) return;
  // The button may have gone up while the chunk loaded: the first move with no button ends the drag.
  const doc = api.internalEngine().ownerDocument;
  const check = (move: MouseEvent) => {
    doc.removeEventListener("mousemove", check, true);
    if (move.buttons === 0 && api.internalEngine().dragHandler.pointerDown())
      doc.dispatchEvent(new MouseEvent("mouseup", { clientX: move.clientX, clientY: move.clientY, bubbles: true }));
  };
  doc.addEventListener("mousemove", check, true);
}

/** Tab list keydown (W3C APG tabs, automatic activation): arrows / Home / End move focus between tabs and select. */
export function carouselTabsKeyDown(event: KeyboardEvent, state: CarouselState): void {
  const list = event.currentTarget as HTMLElement | null;
  if (!list || event.altKey || event.ctrlKey || event.metaKey) return;
  const tabs = Array.from(list.querySelectorAll<HTMLElement>("[role='tab']"));
  const current = tabs.indexOf(event.target as HTMLElement);
  if (current < 0) return;
  const vertical = state.options.axis === "y";
  const rtl = state.options.direction === "rtl";
  const prev = vertical ? ["ArrowUp", "ArrowLeft"] : [rtl ? "ArrowRight" : "ArrowLeft"];
  const next = vertical ? ["ArrowDown", "ArrowRight"] : [rtl ? "ArrowLeft" : "ArrowRight"];
  const loop = !!state.options.loop;
  let index = -1;
  if (prev.includes(event.key)) index = current > 0 ? current - 1 : loop ? tabs.length - 1 : current;
  else if (next.includes(event.key)) index = current < tabs.length - 1 ? current + 1 : loop ? 0 : current;
  else if (event.key === "Home") index = 0;
  else if (event.key === "End") index = tabs.length - 1;
  else return;
  event.preventDefault();
  tabs[index]?.focus();
  carouselScrollTo(state, index);
}

/** Keys of the tab list, `data-rk`. */
export function carouselTabsKeys(state: CarouselState): string {
  return state.options.axis === "y" ? "ArrowUp ArrowDown ArrowLeft ArrowRight Home End" : "ArrowLeft ArrowRight Home End";
}
