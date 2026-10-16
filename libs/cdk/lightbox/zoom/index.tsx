// Ported from yet-another-react-lightbox (src/plugins/zoom/{Zoom.tsx,ZoomController.tsx,ZoomWrapper.tsx,ZoomButton.tsx,
// props.ts,hooks/useZoomState.ts,hooks/useZoomSensors.ts,hooks/useZoomImageRect.ts}, v3.32.2), MIT, © Igor Danchenko.
// Rivet:
// - `<LightboxZoom>` (behaviour part, renders nothing) + `<LightboxZoomIn>` / `<LightboxZoomOut>` buttons + free functions
//   (`lightboxZoomIn`, `lightboxZoomOut`, `lightboxChangeZoom`, `lightboxZoomState`) = YARL's Zoom plugin + `zoom.ref`.
// - The zoomed element is the current slide's `[data-lightbox-zoomable]` element (`LightboxImage` sets it; custom slides
//   opt in with the attribute and `supports`): `transform: scale(z) translate(x, y)` (YARL ZoomWrapper), origin centre.
// - Zoom / pan animation = house motion (`../../motion` Motion1D per value; YARL: FLIP keyframes with `animation.zoom`);
//   `rapid` changes (wheel, pinch, pan) jump. Reduced motion jumps.
// - Zoomed in: the image `sizes` grows to the zoomed width so `srcset` fetches a larger candidate (YARL swaps to a
//   preloaded larger image).
// - Sensors are capture listeners on the container installed while the part is mounted (YARL subscribeSensors); the core
//   swipe / arrow keys stop while `state.zoom() > 1` (YARL stopPropagation).
import { untrack } from "@rivetjs/reactivity";
import { clientEffect } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { Motion1D, type Motion1DType } from "../../motion/index.ts";
import { lightboxContainer, lightboxHandled, lightboxReducesMotion } from "../behaviour.ts";
import { LightboxButton, useLightbox } from "../index.tsx";
import { isImageFitCover, isImageSlide, lengthPx, lightboxSlide, msToMotion, round, translateLabel, type LightboxSlide, type LightboxState } from "../state.ts";

/** Zoom plugin options (YARL `ZoomProps`). */
export interface LightboxZoomOptions {
  /** Ratio of image pixels to physical pixels at max zoom. @default 1 */
  maxZoomPixelRatio?: number;
  /** Zoom-in multiplier. @default 2 */
  zoomInMultiplier?: number;
  /** Double-tap delay (ms). @default 300 */
  doubleTapDelay?: number;
  /** Double-click delay (ms). @default 500 */
  doubleClickDelay?: number;
  /** Zoom-in stops reachable by double-click / double-tap. @default 2 */
  doubleClickMaxStops?: number;
  /** Keyboard pan distance (px). @default 50 */
  keyboardMoveDistance?: number;
  /** Wheel zoom distance factor. @default 100 */
  wheelZoomDistanceFactor?: number;
  /** Pinch zoom distance factor. @default 100 */
  pinchZoomDistanceFactor?: number;
  /** YARL v4 pinch: zoom proportional to the finger distance. @default false */
  pinchZoomV4?: boolean;
  /** Zoom with the mouse wheel / trackpad scroll (no Ctrl). @default false */
  scrollToZoom?: boolean;
  /** Minimum zoom. @default 1 */
  minZoom?: number;
  /** Custom slide types that zoom (their `[data-lightbox-zoomable]` element). */
  supports?: readonly string[];
  /** Max zoom of non-image slides (or a function per slide). @default 8 */
  maxZoom?: number | ((slide: LightboxSlide) => number | undefined);
  /** Called when the zoom level changes. */
  onZoom?: (props: { zoom: number }) => void;
}

const DEFAULTS = {
  maxZoomPixelRatio: 1,
  zoomInMultiplier: 2,
  doubleTapDelay: 300,
  doubleClickDelay: 500,
  doubleClickMaxStops: 2,
  keyboardMoveDistance: 50,
  wheelZoomDistanceFactor: 100,
  pinchZoomDistanceFactor: 100,
  pinchZoomV4: false,
  scrollToZoom: false,
  minZoom: 1,
  maxZoom: 8,
};

type Resolved = Omit<typeof DEFAULTS, "maxZoom"> & Pick<LightboxZoomOptions, "supports" | "onZoom" | "maxZoom">;

interface Rect {
  width: number;
  height: number;
}

interface ZoomController {
  state: LightboxState;
  options: Resolved;
  /** Logical (target) values. */
  zoom: number;
  offsetX: number;
  offsetY: number;
  /** Visual values (house motion). */
  mz: Motion1DType;
  mx: Motion1DType;
  my: Motion1DType;
  element: HTMLElement | null;
  pointers: { id: number; clientX: number; clientY: number; pageX: number; pageY: number }[];
  lastPointerDown: number;
  pinch: { previousDistance: number; initialDistance: number; initialZoom: number } | undefined;
}

const zooms = new WeakMap<Element, ZoomController>();

const zoomOf = (state: LightboxState): ZoomController | undefined => {
  const container = lightboxContainer(state);
  return container ? zooms.get(container) : undefined;
};

function currentSlideBox(state: LightboxState): HTMLElement | null {
  return lightboxContainer(state)?.querySelector<HTMLElement>("[data-lightbox-slide][data-current]") ?? null;
}

function zoomTarget(state: LightboxState): HTMLElement | null {
  return currentSlideBox(state)?.querySelector<HTMLElement>("[data-lightbox-zoomable]") ?? null;
}

/** Content box of the current slide (YARL `slideRect`). */
function slideRect(state: LightboxState): Rect {
  const box = currentSlideBox(state);
  if (!box) return { width: 0, height: 0 };
  const width = box.clientWidth;
  const padding = lengthPx(state.carousel.padding, lightboxContainer(state)?.clientWidth ?? width);
  return { width: Math.max(box.clientWidth - 2 * padding, 0), height: Math.max(box.clientHeight - 2 * padding, 0) };
}

/** YARL `useZoomImageRect`: rendered media rect + max zoom of the current slide. */
function imageRect(c: ZoomController): { imageRect: Rect; maxZoom: number } {
  const state = c.state;
  const slide = untrack(() => lightboxSlide(state));
  const rect = slideRect(state);
  let image: Rect = { width: 0, height: 0 };
  let maxImage: Rect = { width: 0, height: 0 };
  const el = zoomTarget(state);
  if (slide && rect.width > 0 && rect.height > 0) {
    if (isImageSlide(slide)) {
      const natural = el instanceof HTMLImageElement ? { width: el.naturalWidth, height: el.naturalHeight } : { width: 0, height: 0 };
      const width = Math.max(...(slide.srcSet?.map((x) => x.width) ?? []), slide.width ?? 0, slide.srcSet || slide.width ? 0 : natural.width);
      const height = Math.max(...(slide.srcSet?.map((x) => x.height) ?? []), slide.height ?? 0, slide.srcSet || slide.height ? 0 : natural.height);
      if (width > 0 && height > 0) {
        const cover = isImageFitCover(slide, state.carousel.imageFit);
        maxImage = cover
          ? {
              width: Math.round(Math.min(width, (rect.width / rect.height) * height)),
              height: Math.round(Math.min(height, (rect.height / rect.width) * width)),
            }
          : { width, height };
        maxImage = { width: maxImage.width * c.options.maxZoomPixelRatio, height: maxImage.height * c.options.maxZoomPixelRatio };
        image = cover
          ? { width: Math.min(rect.width, maxImage.width, width), height: Math.min(rect.height, maxImage.height, height) }
          : {
              width: Math.round(Math.min(rect.width, (rect.height / height) * width, width)),
              height: Math.round(Math.min(rect.height, (rect.width / width) * height, height)),
            };
      }
    } else if (el) {
      image = { width: Math.min(rect.width, el.offsetWidth || rect.width), height: Math.min(rect.height, el.offsetHeight || rect.height) };
    }
  }
  let maxZoom = 1;
  if (slide && image.width) {
    if (isImageSlide(slide)) maxZoom = Math.max(round(maxImage.width / image.width, 5), 1);
    else {
      const option = c.options.maxZoom;
      const resolved = typeof option === "function" ? (option(slide) ?? DEFAULTS.maxZoom) : typeof option === "number" ? option : DEFAULTS.maxZoom;
      maxZoom = Math.max(resolved, 1);
    }
  }
  return { imageRect: image, maxZoom };
}

function supported(c: ZoomController): boolean {
  const slide = untrack(() => lightboxSlide(c.state));
  if (!slide) return false;
  return isImageSlide(slide) || !!(slide.type && c.options.supports?.includes(slide.type));
}

function paint(c: ZoomController): void {
  const el = c.element;
  if (!el) return;
  const value = (m: Motion1DType) => (m.settled() ? m.target.get() : m.get());
  const z = value(c.mz),
    x = value(c.mx),
    y = value(c.my);
  if (Math.abs(z - 1) < 1e-4 && Math.abs(x) < 0.05 && Math.abs(y) < 0.05 && c.zoom === 1) {
    el.style.removeProperty("transform");
    el.style.removeProperty("transform-origin");
  } else {
    el.style.transformOrigin = "50% 50%";
    el.style.transform = `scale(${round(z, 4)}) translateX(${round(x, 2)}px) translateY(${round(y, 2)}px)`;
  }
}

/** Applies the logical values to the motions (`rapid`: jump). */
function commit(c: ZoomController, rapid: boolean): void {
  const jump = rapid || lightboxReducesMotion();
  const units = msToMotion(c.state.animation.zoom);
  for (const [m, v] of [
    [c.mz, c.zoom],
    [c.mx, c.offsetX],
    [c.my, c.offsetY],
  ] as const) {
    if (jump || !units) m.to(v, true);
    else {
      m.to(v);
      m.scrollBody.useDuration(units);
    }
  }
  paint(c);
}

function setZoomValue(c: ZoomController, zoom: number): void {
  const previous = c.zoom;
  c.zoom = zoom;
  const container = lightboxContainer(c.state);
  if (container) {
    if (zoom > 1) container.setAttribute("data-zoomed", "true");
    else container.removeAttribute("data-zoomed");
  }
  if (previous !== zoom) {
    c.state.zoom.set(zoom);
    c.options.onZoom?.({ zoom });
  }
}

/** YARL `changeOffsets`. */
function changeOffsets(c: ZoomController, dx = 0, dy = 0, targetZoom?: number): void {
  const zoom = targetZoom || c.zoom;
  const { imageRect: image } = imageRect(c);
  const rect = slideRect(c.state);
  const newX = c.offsetX - dx;
  const newY = c.offsetY - dy;
  const maxX = (image.width * zoom - rect.width) / 2 / zoom;
  const maxY = (image.height * zoom - rect.height) / 2 / zoom;
  c.offsetX = Math.min(Math.abs(newX), Math.max(maxX, 0)) * Math.sign(newX);
  c.offsetY = Math.min(Math.abs(newY), Math.max(maxY, 0)) * Math.sign(newY);
}

/** YARL `changeZoom`: clamp, keep the point under (`dx`, `dy`) (container-centre coordinates) in place. */
function changeZoom(c: ZoomController, targetZoom: number, rapid = false, dx?: number, dy?: number): void {
  if (!supported(c)) return;
  c.element = zoomTarget(c.state);
  const { maxZoom, imageRect: image } = imageRect(c);
  c.state.maxZoom.set(maxZoom);
  const minZoom = c.options.minZoom;
  const zoom = round(targetZoom + 0.01 < maxZoom ? (targetZoom - 0.01 > minZoom ? targetZoom : minZoom) : maxZoom, 5);
  changeOffsets(c, dx ? dx * (1 / c.zoom - 1 / zoom) : 0, dy ? dy * (1 / c.zoom - 1 / zoom) : 0, zoom);
  setZoomValue(c, zoom);
  if (zoom > 1 && c.element instanceof HTMLImageElement && c.element.srcset) {
    const wanted = Math.ceil(image.width * zoom);
    const current = parseInt(c.element.getAttribute("sizes") ?? "") || 0;
    if (wanted > current && /px$/.test(c.element.getAttribute("sizes") ?? "px")) c.element.setAttribute("sizes", `${wanted}px`);
    else if (!/px$/.test(c.element.getAttribute("sizes") ?? "")) c.element.setAttribute("sizes", `${wanted}px`);
  }
  commit(c, rapid);
}

/** Resets zoom + offsets (slide change). */
function reset(c: ZoomController): void {
  if (c.element) {
    c.element.style.removeProperty("transform");
    c.element.style.removeProperty("transform-origin");
  }
  c.offsetX = 0;
  c.offsetY = 0;
  c.pointers = [];
  c.lastPointerDown = 0;
  c.pinch = undefined;
  setZoomValue(c, 1);
  c.mz.to(1, true);
  c.mx.to(0, true);
  c.my.to(0, true);
  c.element = zoomTarget(c.state);
  c.state.maxZoom.set(supported(c) ? imageRect(c).maxZoom : 1);
}

/* ------------------------------------------------------------------------------------------------
 * Public API (YARL ZoomRef)
 * ----------------------------------------------------------------------------------------------*/

/** Zoom in by `zoomInMultiplier` (YARL `zoomIn`). */
export function lightboxZoomIn(state: LightboxState): void {
  const c = zoomOf(state);
  if (!c) return;
  const target = c.zoom * c.options.zoomInMultiplier;
  changeZoom(c, c.zoom < 1 && target > 1 ? 1 : target);
}

/** Zoom out by `zoomInMultiplier` (YARL `zoomOut`). */
export function lightboxZoomOut(state: LightboxState): void {
  const c = zoomOf(state);
  if (!c) return;
  const target = c.zoom / c.options.zoomInMultiplier;
  changeZoom(c, c.zoom > 1 && target < 1 ? 1 : target);
}

/** Set the zoom level (YARL `changeZoom(targetZoom, rapid?, dx?, dy?)`). */
export function lightboxChangeZoom(state: LightboxState, targetZoom: number, rapid?: boolean, dx?: number, dy?: number): void {
  const c = zoomOf(state);
  if (c) changeZoom(c, targetZoom, rapid, dx, dy);
}

/** Zoom state (YARL `ZoomRef` fields). */
export function lightboxZoomState(state: LightboxState): { zoom: number; maxZoom: number; offsetX: number; offsetY: number; disabled: boolean } {
  const c = zoomOf(state);
  return {
    zoom: c?.zoom ?? 1,
    maxZoom: untrack(state.maxZoom),
    offsetX: c?.offsetX ?? 0,
    offsetY: c?.offsetY ?? 0,
    disabled: !c || !supported(c) || untrack(state.maxZoom) <= 1,
  };
}

/* ------------------------------------------------------------------------------------------------
 * Sensors (YARL useZoomSensors)
 * ----------------------------------------------------------------------------------------------*/

const distance = (a: { clientX: number; clientY: number }, b: { clientX: number; clientY: number }) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

function scaleZoom(value: number, delta: number, factor = 100, clamp = 2): number {
  return value * Math.min(1 + Math.abs(delta / factor), clamp) ** Math.sign(delta);
}

function translateCoordinates(state: LightboxState, event: { pageX: number; pageY: number }): [number, number] | [] {
  const container = lightboxContainer(state);
  if (!container) return [];
  const { left, top, width, height } = container.getBoundingClientRect();
  return [event.pageX - left - scrollX - width / 2, event.pageY - top - scrollY - height / 2];
}

function install(state: LightboxState, options: Resolved): (() => void) | undefined {
  const container = lightboxContainer(state);
  if (!container) return undefined;
  const c: ZoomController = {
    state,
    options,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    mz: undefined as never,
    mx: undefined as never,
    my: undefined as never,
    element: null,
    pointers: [],
    lastPointerDown: 0,
    pinch: undefined,
  };
  const draw = () => paint(c);
  c.mz = Motion1D({ value: 1, render: draw });
  c.mx = Motion1D({ value: 0, render: draw });
  c.my = Motion1D({ value: 0, render: draw });
  zooms.set(container, c);

  const onKeyDown = (event: KeyboardEvent) => {
    const { key, metaKey, ctrlKey } = event;
    const meta = metaKey || ctrlKey;
    const prevent = () => {
      event.preventDefault();
      lightboxHandled.add(event);
    };
    if (c.zoom > 1) {
      const d = options.keyboardMoveDistance;
      const move = (dx: number, dy: number) => {
        prevent();
        changeOffsets(c, dx, dy);
        commit(c, false);
      };
      if (key === "ArrowDown") move(0, d);
      else if (key === "ArrowUp") move(0, -d);
      else if (key === "ArrowLeft") move(-d, 0);
      else if (key === "ArrowRight") move(d, 0);
    }
    if (key === "+" || (meta && key === "=")) {
      prevent();
      lightboxZoomIn(state);
    } else if (key === "-" || (meta && key === "_")) {
      prevent();
      lightboxZoomOut(state);
    } else if (meta && key === "0") {
      prevent();
      changeZoom(c, 1);
    }
  };

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || options.scrollToZoom) {
      if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
        lightboxHandled.add(event);
        event.preventDefault();
        changeZoom(c, scaleZoom(c.zoom, -event.deltaY, options.wheelZoomDistanceFactor), true, ...translateCoordinates(state, event));
        return;
      }
    }
    if (c.zoom > 1) {
      lightboxHandled.add(event);
      event.preventDefault();
      if (!options.scrollToZoom) {
        changeOffsets(c, event.deltaX, event.deltaY);
        commit(c, true);
      }
    }
  };

  const replacePointer = (event: PointerEvent) => {
    c.pointers = c.pointers.filter((p) => p.id !== event.pointerId);
    c.pointers.push({ id: event.pointerId, clientX: event.clientX, clientY: event.clientY, pageX: event.pageX, pageY: event.pageY });
  };

  const onPointerDown = (event: PointerEvent) => {
    if (event.pointerType === "mouse" && event.buttons > 1) return;
    const box = currentSlideBox(state);
    if (!box || !(event.target instanceof Node) || !box.contains(event.target)) return;
    if (!supported(c)) return;
    if (c.zoom > 1) lightboxHandled.add(event);
    const { timeStamp } = event;
    if (c.pointers.length === 0 && timeStamp - c.lastPointerDown < (event.pointerType === "touch" ? options.doubleTapDelay : options.doubleClickDelay)) {
      c.lastPointerDown = 0;
      const { maxZoom } = imageRect(c);
      const minZoom = options.minZoom;
      const stops = options.doubleClickMaxStops;
      const target =
        c.zoom >= 1
          ? c.zoom !== maxZoom
            ? c.zoom * Math.max(maxZoom ** (1 / stops), options.zoomInMultiplier)
            : 1
          : c.zoom !== minZoom
            ? c.zoom / Math.max(minZoom ** (-1 / stops), options.zoomInMultiplier)
            : 1;
      changeZoom(c, target, false, ...translateCoordinates(state, event));
    } else c.lastPointerDown = timeStamp;
    replacePointer(event);
    if (c.pointers.length === 2) {
      const initial = distance(c.pointers[0]!, c.pointers[1]!);
      c.pinch = { previousDistance: initial, initialDistance: Math.max(initial, 1), initialZoom: c.zoom };
    }
  };

  const onPointerMove = (event: PointerEvent) => {
    const active = c.pointers.find((p) => p.id === event.pointerId);
    if (c.pointers.length === 2 && c.pinch) {
      lightboxHandled.add(event);
      replacePointer(event);
      const current = distance(c.pointers[0]!, c.pointers[1]!);
      const target = options.pinchZoomV4
        ? (c.pinch.initialZoom / c.pinch.initialDistance) * current
        : scaleZoom(c.zoom, current - c.pinch.previousDistance, options.pinchZoomDistanceFactor);
      const centre = c.pointers.map((p) => translateCoordinates(state, p) as number[]).reduce((acc, xy) => xy.map((v, i) => (acc[i] ?? 0) + v / 2), [0, 0]);
      changeZoom(c, target, true, centre[0], centre[1]);
      c.pinch.previousDistance = current;
      return;
    }
    if (c.zoom > 1) {
      lightboxHandled.add(event);
      if (active) {
        if (c.pointers.length === 1) {
          changeOffsets(c, (active.clientX - event.clientX) / c.zoom, (active.clientY - event.clientY) / c.zoom);
          commit(c, true);
        }
        replacePointer(event);
      }
    }
  };

  const onPointerUp = (event: PointerEvent) => {
    if (c.pointers.length === 2 && c.pointers.find((p) => p.id === event.pointerId)) c.pinch = undefined;
    c.pointers = c.pointers.filter((p) => p.id !== event.pointerId);
  };

  const onLoad = () => {
    if (c.zoom === 1) c.state.maxZoom.set(supported(c) ? imageRect(c).maxZoom : 1);
  };

  const listen: [string, EventListener][] = [
    ["keydown", onKeyDown as EventListener],
    ["wheel", onWheel as EventListener],
    ["pointerdown", onPointerDown as EventListener],
    ["pointermove", onPointerMove as EventListener],
    ["pointerup", onPointerUp as EventListener],
    ["pointercancel", onPointerUp as EventListener],
    ["load", onLoad],
  ];
  for (const [type, fn] of listen) container.addEventListener(type, fn, { capture: true, passive: type !== "wheel" });
  return () => {
    for (const [type, fn] of listen) container.removeEventListener(type, fn, { capture: true });
    c.mz.stop();
    c.mx.stop();
    c.my.stop();
    zooms.delete(container);
    untrack(() => state.zoom.set(1));
  };
}

/* ------------------------------------------------------------------------------------------------
 * Parts
 * ----------------------------------------------------------------------------------------------*/

export interface LightboxZoomProps extends LightboxZoomOptions {}

/**
 * Enables zoom inside a lightbox (YARL Zoom plugin): wheel (Ctrl / `scrollToZoom`), pinch, double click / tap, pan
 * (pointer, wheel, arrow keys), `+` / `-` / Ctrl+0. Place it among the lightbox parts; renders nothing.
 */
export function LightboxZoom(props: LightboxZoomProps) {
  const state = useLightbox();
  const options = { ...DEFAULTS, ...props } as Resolved;
  clientEffect(() => untrack(() => install(state, options)));
  // Reset on slide change (YARL: layout effect on globalIndex / current src).
  clientEffect(() => {
    state.globalIndex();
    untrack(() => {
      const c = zoomOf(state);
      if (c) queueMicrotask(() => reset(c));
    });
  });
  return null;
}

export interface LightboxZoomButtonProps {
  class?: string;
  style?: StyleObject;
  label?: string;
  children?: Content;
}

/** Zoom-in button (YARL ZoomButton `zoomIn`): disabled at max zoom or when the slide does not zoom. */
export function LightboxZoomIn(props: LightboxZoomButtonProps) {
  const state = useLightbox();
  return (
    <LightboxButton
      class={props.class}
      style={props.style}
      action="zoom-in"
      label={props.label ?? translateLabel(state.labels, "Zoom in")}
      isDisabled={() => state.maxZoom() <= 1 || state.zoom() >= state.maxZoom()}
      onPress={() => lightboxZoomIn(state)}
    >
      {props.children}
    </LightboxButton>
  );
}

/** Zoom-out button (YARL ZoomButton `zoomOut`): disabled at min zoom. */
export function LightboxZoomOut(props: LightboxZoomButtonProps) {
  const state = useLightbox();
  return (
    <LightboxButton
      class={props.class}
      style={props.style}
      action="zoom-out"
      label={props.label ?? translateLabel(state.labels, "Zoom out")}
      isDisabled={() => state.maxZoom() <= 1 || state.zoom() <= 1}
      onPress={() => lightboxZoomOut(state)}
    >
      {props.children}
    </LightboxButton>
  );
}
