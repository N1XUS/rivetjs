// Rivet Carousel parts (no RAC component): an embla-carousel engine (`./engine/`, port of embla-carousel 8.6.0, MIT,
// © David Jerleke) under RAC-style parts, with W3C APG carousel semantics (basic + tabbed variants, rotation control).
// `<Carousel><CarouselViewport><CarouselContainer><CarouselSlide/>…</CarouselContainer></CarouselViewport>
//  <CarouselPrevious/><CarouselNext/><CarouselDots/><CarouselRotationControl/></Carousel>`.
// - Carousel = APG carousel container (`role="region"`, `aria-roledescription="carousel"`, label from
//   `aria-label` / `aria-labelledby`); embla options are its props (`align`, `axis`, `loop`, …), plus `autoplay`,
//   `autoScroll`, `plugins`, `onApi`, `onSelect`, `onSettle`. State = `createCarouselState` (`./state.ts`);
//   behaviour = `./behaviour.tsx` (engine lifecycle, handlers bound from inline arrows here → resumable, no code before
//   the first interaction unless autoplay / auto scroll, `plugins` or `onApi` is set: then it starts when visible).
// - CarouselViewport = embla root (`overflow: hidden`, `touch-action` per axis: behaviour styles, inline);
//   CarouselContainer = embla container (`display: flex`, column on `axis="y"`; before the engine runs, a
//   `startIndex` > 0 is shown with a CSS transform from `--rv-carousel-slide-size` — exact for uniform slides);
//   CarouselSlide = APG slide (`role="group"`, `aria-roledescription="slide"`, "N of M" label; `role="tabpanel"`
//   labelled by its tab when the carousel has `CarouselDots`, i.e. `tabs`), `flex: 0 0 var(--rv-carousel-slide-size, 100%)`.
// - embla ClassNames plugin → headless `data-*`: slides `data-snapped`, `data-in-view`; root `data-draggable`,
//   `data-dragging`, `data-loop`; plus `data-orientation`, `data-playing`, `data-ready`.
// - CarouselPrevious / CarouselNext = cdk `Button` (disabled per `canScrollPrev` / `canScrollNext`); CarouselDots =
//   APG tab list (`role="tablist"`, automatic activation, roving tabindex) of CarouselDot (`role="tab"`);
//   CarouselRotationControl = APG rotation control (cdk `Button`, label "Stop / Start automatic slide show").
// - Render props are accessors (`selectedIndex()`, `canScrollNext()`, `isPlaying()`, …); `render` (RAC DOMRenderProps)
//   on every part: `if (render) return render(attrs, renderProps)` before the compiled element.
// - Parts forward `data-*` (globalDOMProps): a styled layer adds `data-slot` per part.
import { createContext, untrack, useContext } from "@rivetjs/reactivity";
import { For, Provider as ContextProvider, clientEffect, ref as createRef, type Ref } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import { useLocale } from "../i18n/index.ts";
import { Button, type ButtonProps } from "../button/index.tsx";
import { type DOMRenderProps } from "../utils/render.ts";
import { globalDOMProps, type GlobalDOMAttributes } from "../utils/dom-props.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { useId } from "../utils/id.ts";
import { read, type MaybeAccessor } from "../interactions/utils.ts";
import {
  Provider,
  contextProps,
  mergeRefValues,
  type ClassNameOrFunction,
  type ContextValue,
  type RefValue,
  type RenderProps,
  type SlotProps,
  type StyleObject,
} from "../slots/index.tsx";
import {
  createCarouselState,
  estimateRegistry,
  hasRotation,
  isRotating,
  isSlideInView,
  isSlideSnapped,
  type CarouselOptions,
  type CarouselState,
  type CarouselStateOptions,
} from "./state.ts";
import {
  carouselDragStart,
  carouselEffect,
  carouselFocusIn,
  carouselKeyDown,
  carouselKeys,
  carouselPointerDown,
  carouselScrollNext,
  carouselScrollPrev,
  carouselScrollTo,
  carouselSlideId,
  carouselTabId,
  carouselTabsKeyDown,
  carouselTabsKeys,
  carouselViewportId,
  toggleRotation,
} from "./behaviour.tsx";
import { renderPropsOf } from "../slots/index.tsx";

export * from "./state.ts";
export * from "./behaviour.tsx";

type Orientation = "horizontal" | "vertical";

export interface CarouselRenderProps {
  /** Selected snap index. */
  selectedIndex: () => number;
  /** Number of snaps. */
  snapCount: () => number;
  /** Whether there is a previous / next snap (`loop`: always with more than one snap). */
  canScrollPrev: () => boolean;
  canScrollNext: () => boolean;
  /**
   * Whether autoplay / auto scroll rotates.
   *
   * @selector [data-playing]
   */
  isPlaying: () => boolean;
  /**
   * Whether rotation is on (autoplay / auto scroll configured, not stopped by the user): a hover pause keeps it on.
   * Drives the rotation control label and the slides' `aria-live` (W3C APG).
   */
  isRotating: () => boolean;
  /**
   * Whether the pointer drags the viewport.
   *
   * @selector [data-dragging]
   */
  isDragging: () => boolean;
  /**
   * `axis="x"` → horizontal, `axis="y"` → vertical.
   *
   * @selector [data-orientation="horizontal | vertical"]
   */
  orientation: () => Orientation;
  /** State of the carousel (signals + `./behaviour.tsx` commands: `carouselScrollTo(state, i)`, `carouselApi(state)`). */
  state: CarouselState;
}

export interface CarouselProps
  extends
    CarouselOptions,
    Omit<CarouselStateOptions, "id" | keyof CarouselOptions>,
    RenderProps<CarouselRenderProps>,
    DOMRenderProps<"div", CarouselRenderProps>,
    SlotProps,
    Omit<GlobalDOMAttributes<HTMLDivElement>, "style" | "dir"> {
  /** The element's unique id (prefix of the parts' ids). */
  id?: string;
  /** Accessible name of the carousel (APG: `aria-label` or `aria-labelledby` on the carousel container). */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  /** @default "carousel" */
  "aria-roledescription"?: string;
  /**
   * W3C APG tabbed carousel: slides become `role="tabpanel"` labelled by their `CarouselDot` (render `CarouselDots`).
   * @default false
   */
  tabs?: boolean;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-Carousel'
   */
  class?: ClassNameOrFunction<CarouselRenderProps>;
  ref?: RefValue<HTMLDivElement>;
}

/** Props for the Carousel from a parent (slots). */
export const CarouselContext = createContext<ContextValue<Partial<CarouselProps>, HTMLDivElement>>(null);
/** The carousel state (`createCarouselState`). */
export const CarouselStateContext = createContext<CarouselState | null>(null);
/** Viewport ref + tabbed flag for the parts. */
export const CarouselPartsContext = createContext<{ viewport: Ref<HTMLElement>; tabs: boolean } | null>(null);
/** Index of the slide rendered inside (`CarouselContainer items`). */
export const CarouselSlideIndexContext = createContext<(() => number) | null>(null);

const ENGINE_KEYS = [
  "align",
  "axis",
  "direction",
  "loop",
  "slidesToScroll",
  "containScroll",
  "dragFree",
  "dragThreshold",
  "duration",
  "startIndex",
  "skipSnaps",
  "inViewThreshold",
  "watchDrag",
  "watchResize",
  "watchSlides",
  "watchFocus",
  "breakpoints",
  "active",
] as const;
const ROOT_OWNED = ["style", "render", "dir"] as const;

function renderValues(state: CarouselState): CarouselRenderProps {
  return {
    selectedIndex: () => state.selectedIndex(),
    snapCount: () => state.snapCount(),
    canScrollPrev: () => state.canScrollPrev(),
    canScrollNext: () => state.canScrollNext(),
    isPlaying: () => state.isPlaying(),
    isRotating: () => isRotating(state),
    isDragging: () => state.isDragging(),
    orientation: () => (state.options.axis === "y" ? "vertical" : "horizontal"),
    state,
  };
}

/**
 * A carousel presents a set of slides one (group) at a time, with drag / swipe, previous / next buttons, optional
 * tab picker and rotation (embla-carousel engine, W3C APG carousel pattern).
 */
export function Carousel(inProps: CarouselProps) {
  const [props, ref] = contextProps(inProps, inProps.ref, CarouselContext) as [CarouselProps, RefValue<HTMLDivElement> | undefined];
  const { direction: localeDirection } = useLocale();
  const engine: Record<string, unknown> = {};
  for (const key of ENGINE_KEYS) if (props[key] !== undefined) engine[key] = props[key];
  if (engine.direction === undefined) engine.direction = localeDirection;
  const state = createCarouselState({
    ...(engine as CarouselOptions),
    id: useId(props.id),
    slideCount: props.slideCount,
    autoplay: props.autoplay,
    autoScroll: props.autoScroll,
    plugins: props.plugins,
    onApi: props.onApi,
    onSelect: props.onSelect,
    onSettle: props.onSettle,
  });
  const viewport = createRef<HTMLElement>();
  // Client render: start after mount. Resumed page: with rotation, `plugins` or `onApi` (embla inits them on mount:
  // Fade / AutoHeight / tweens must run before the first interaction) the engine starts when the viewport is
  // visible; otherwise the first interaction starts it (`ensureCarousel` in the handlers).
  if (typeof document !== "undefined" || hasRotation(state) || state.plugins || state.onApi)
    clientEffect(() => carouselEffect(state, viewport()), { when: "visible" });
  const values = renderValues(state);
  const rp = renderPropsOf(props, { values, defaultClassName: "rv-Carousel" });
  const dom = globalDOMProps(props, ROOT_OWNED);
  const slot = props.slot || undefined;
  const id = state.id;
  const label = props["aria-label"];
  const labelledBy = props["aria-labelledby"];
  const describedBy = props["aria-describedby"];
  const roleDescription = props["aria-roledescription"] ?? "carousel";
  const orientation = state.options.axis === "y" ? "vertical" : "horizontal";
  const keys = carouselKeys(state);
  const loop = state.options.loop ? "true" : undefined;
  const draggable = state.options.watchDrag !== false ? "true" : undefined;
  const parts = { viewport, tabs: !!props.tabs };
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: ref as never,
        id,
        role: "region",
        "aria-roledescription": roleDescription,
        "aria-label": label,
        "aria-labelledby": labelledBy,
        "aria-describedby": describedBy,
        slot,
        class: () => rp.class(),
        style: () => rp.style(),
        "data-orientation": orientation,
        "data-loop": loop,
        "data-draggable": draggable,
        "data-dragging": () => dataBool(state.isDragging()),
        "data-playing": () => dataBool(state.isPlaying()),
        "data-ready": () => dataBool(state.isReady()),
        "data-rk": keys,
        onKeyDown: (event: KeyboardEvent) => carouselKeyDown(event, state),
        onFocusIn: (event: FocusEvent) => carouselFocusIn(event, state),
        children: () => (
          <Provider
            values={[
              [CarouselStateContext, state],
              [CarouselPartsContext, parts],
            ]}
          >
            {rp.children()}
          </Provider>
        ),
      } as never,
      values,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      id={id}
      role="region"
      aria-roledescription={roleDescription}
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      slot={slot}
      class={rp.class()}
      style={rp.style()}
      data-orientation={orientation}
      data-loop={loop}
      data-draggable={draggable}
      data-dragging={dataBool(state.isDragging())}
      data-playing={dataBool(state.isPlaying())}
      data-ready={dataBool(state.isReady())}
      data-rk={keys}
      preload="visible"
      onKeyDown={(event) => carouselKeyDown(event, state)}
      onFocusIn={(event) => carouselFocusIn(event, state)}
    >
      <Provider
        values={[
          [CarouselStateContext, state],
          [CarouselPartsContext, parts],
        ]}
      >
        {rp.children()}
      </Provider>
    </div>
  );
}

function useCarousel(part: string): { state: CarouselState; parts: { viewport: Ref<HTMLElement>; tabs: boolean } } {
  const state = useContext(CarouselStateContext);
  const parts = useContext(CarouselPartsContext);
  if (!state || !parts) throw new Error(`<${part}> must be rendered inside a <Carousel>.`);
  return { state, parts };
}

// --- Viewport ---

export interface CarouselViewportProps
  extends RenderProps<CarouselRenderProps>, DOMRenderProps<"div", CarouselRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-CarouselViewport'
   */
  class?: ClassNameOrFunction<CarouselRenderProps>;
  ref?: RefValue<HTMLDivElement>;
}

const VIEWPORT_OWNED = ["style", "render", "onPointerDown", "onMouseDown", "onTouchStart"] as const;

/** The clipping viewport (embla root node): drag / swipe surface. */
export function CarouselViewport(props: CarouselViewportProps) {
  const { state, parts } = useCarousel("CarouselViewport");
  const values = renderValues(state);
  const rp = renderPropsOf(props, {
    values,
    defaultClassName: "rv-CarouselViewport",
    // Behaviour styles: clip the track; let the browser keep the cross-axis pan (embla docs `touch-action`).
    defaultStyle: { overflow: "hidden", touchAction: state.options.axis === "y" ? "pan-x pinch-zoom" : "pan-y pinch-zoom" },
  });
  const dom = globalDOMProps(props, VIEWPORT_OWNED);
  const userPointerDown = props.onPointerDown as ((e: PointerEvent) => void) | undefined;
  const userMouseDown = props.onMouseDown as ((e: MouseEvent) => void) | undefined;
  const userTouchStart = props.onTouchStart as ((e: TouchEvent) => void) | undefined;
  const userRef = props.ref;
  const ref = mergeRefValues(userRef as RefValue<HTMLElement> | undefined, parts.viewport) as never;
  const id = carouselViewportId(state);
  if (props.render)
    return props.render(
      {
        ...dom,
        ref,
        id,
        class: () => rp.class(),
        style: () => rp.style(),
        onPointerDown: (event: PointerEvent) => {
          carouselPointerDown(event, state);
          userPointerDown?.(event);
        },
        onMouseDown: (event: MouseEvent) => {
          carouselDragStart(event, state);
          userMouseDown?.(event);
        },
        onTouchStart: (event: TouchEvent) => {
          carouselDragStart(event, state);
          userTouchStart?.(event);
        },
        children: () => rp.children(),
      } as never,
      values,
    );
  return (
    <div
      {...dom}
      ref={ref}
      id={id}
      class={rp.class()}
      style={rp.style()}
      preload="visible"
      onPointerDown={(event) => {
        carouselPointerDown(event, state);
        userPointerDown?.(event);
      }}
      onMouseDown={(event) => {
        carouselDragStart(event, state);
        userMouseDown?.(event);
      }}
      onTouchStart={(event) => {
        carouselDragStart(event, state);
        userTouchStart?.(event);
      }}
    >
      {rp.children()}
    </div>
  );
}

// --- Container ---

export interface CarouselContainerProps<T = unknown>
  extends Omit<RenderProps<CarouselRenderProps>, "children">, DOMRenderProps<"div", CarouselRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Slides as data: `children` is then `(item, index) => <CarouselSlide>…</CarouselSlide>` (the slide count is known on the server). */
  items?: readonly T[] | (() => readonly T[]);
  /** Key of an item (`items`). @default the item itself */
  by?: (item: T, index: number) => unknown;
  /** Static slides, or a slide renderer for `items`. */
  children?: Content | ((item: T, index: () => number) => Content);
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-CarouselContainer'
   */
  class?: ClassNameOrFunction<CarouselRenderProps>;
  ref?: RefValue<HTMLDivElement>;
}

/**
 * Server / pre-engine offset of the `startIndex` snap (uniform slides of `--rv-carousel-slide-size`, no gaps), as a CSS
 * `translate` value: a property of its own, so it never fights embla's `transform`; removed when the engine runs.
 */
function startOffset(state: CarouselState): string | undefined {
  const start = untrack(state.selectedIndex);
  if (!start) return undefined;
  const { align = "center", axis, direction, slidesToScroll } = state.options;
  const group = typeof slidesToScroll === "number" && slidesToScroll > 1 ? slidesToScroll : 1;
  const size = "var(--rv-carousel-slide-size, 100%)";
  const groupSize = `(${group} * ${size})`;
  const alignOffset = align === "start" ? "0px" : align === "end" ? `(100% - ${groupSize})` : align === "center" ? `((100% - ${groupSize}) / 2)` : "0px";
  const sign = axis !== "y" && direction === "rtl" ? -1 : 1;
  const offset = `calc(${sign} * (${alignOffset} - ${start * group} * ${size}))`;
  return axis === "y" ? `0px ${offset}` : `${offset} 0px`;
}

/** The slide track (embla container node): translated by the engine. */
export function CarouselContainer<T>(props: CarouselContainerProps<T>) {
  const { state } = useCarousel("CarouselContainer");
  const values = renderValues(state);
  const { items, by, children } = props;
  // Slide indexes follow render order (static children).
  state.refs.count = 0;
  state.refs.seen = new WeakMap();
  const list = items === undefined ? undefined : typeof items === "function" ? items : () => items as readonly T[];
  if (list) {
    const count = untrack(list).length;
    if (count && !untrack(state.isReady)) {
      const registry = estimateRegistry(count, state.options.slidesToScroll);
      state.slideCount.set(count);
      state.snapCount.set(Math.max(registry.length, 1));
      state.slideRegistry.set(registry);
      state.canScrollPrev.set(registry.length > 1 && (!!state.options.loop || untrack(state.selectedIndex) > 0));
      state.canScrollNext.set(registry.length > 1 && (!!state.options.loop || untrack(state.selectedIndex) < registry.length - 1));
    }
  }
  const offset = startOffset(state);
  const rp = renderPropsOf(
    props as never,
    {
      values,
      defaultClassName: "rv-CarouselContainer",
      // Behaviour styles: the flex track embla measures.
      defaultStyle: { display: "flex", ...(state.options.axis === "y" ? { flexDirection: "column" } : {}) } as StyleObject,
    },
    ["class", "style"],
  );
  // The server offset of `startIndex` until the engine translates (`startCarousel` clears it before measuring).
  const style = (): StyleObject | undefined => (offset && !state.isReady() ? { ...rp.style(), translate: offset } : rp.style());
  const dom = globalDOMProps(props, ["style", "render"]);
  const ref = props.ref;
  // APG: the slides container is a live region while not rotating.
  const content = (): Content =>
    list
      ? ((
          <For each={list} by={(by ?? ((item: T) => item)) as (item: T, index: number) => unknown}>
            {(item, index) => (
              <ContextProvider token={CarouselSlideIndexContext} value={index}>
                {(children as (item: T, index: () => number) => Content)(untrack(item), index)}
              </ContextProvider>
            )}
          </For>
        ) as Content)
      : (renderSlot(children as Content) as Content);
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: ref as never,
        class: () => rp.class(),
        style: () => style(),
        "aria-live": () => (isRotating(state) ? "off" : "polite"),
        children: () => content(),
      } as never,
      values,
    );
  return (
    <div {...dom} ref={ref as never} class={rp.class()} style={style()} aria-live={isRotating(state) ? "off" : "polite"}>
      {content()}
    </div>
  );
}

// --- Slide ---

export interface CarouselSlideRenderProps extends CarouselRenderProps {
  /** Index of the slide. */
  index: () => number;
  /**
   * Whether the slide belongs to the selected snap (embla ClassNames `is-snapped`).
   *
   * @selector [data-snapped]
   */
  isSnapped: () => boolean;
  /**
   * Whether the slide is in view (embla ClassNames `is-in-view`; after the engine started).
   *
   * @selector [data-in-view]
   */
  isInView: () => boolean;
}

export interface CarouselSlideProps
  extends RenderProps<CarouselSlideRenderProps>, DOMRenderProps<"div", CarouselSlideRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** Index of the slide (default: render order, or the `CarouselContainer items` index). */
  index?: number;
  /** Accessible name (default `"<n> of <count>"` once the slide count is known). */
  "aria-label"?: MaybeAccessor<string | undefined>;
  "aria-labelledby"?: string;
  /** @default "slide" */
  "aria-roledescription"?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-CarouselSlide'
   */
  class?: ClassNameOrFunction<CarouselSlideRenderProps>;
  ref?: RefValue<HTMLDivElement>;
}

/** A slide (APG `role="group"` + `aria-roledescription="slide"`; tab panel in a tabbed carousel). */
export function CarouselSlide(props: CarouselSlideProps) {
  const { state, parts } = useCarousel("CarouselSlide");
  const fromItems = useContext(CarouselSlideIndexContext);
  // Render order; the same props object (a resumed slide's probe + adopt runs) keeps its index.
  const seen = state.refs.seen;
  let fixed = props.index;
  if (fixed === undefined && !fromItems) {
    fixed = seen.get(props);
    if (fixed === undefined) seen.set(props, (fixed = state.refs.count++));
  }
  const slide = { index: () => (fixed !== undefined ? fixed : fromItems!()) };
  const values: CarouselSlideRenderProps = {
    ...renderValues(state),
    index: slide.index,
    isSnapped: () => isSlideSnapped(state, slide.index()),
    isInView: () => isSlideInView(state, slide.index()),
  };
  const rp = renderPropsOf(props, {
    values,
    defaultClassName: "rv-CarouselSlide",
    // Behaviour style: the slide size embla measures (set `--rv-carousel-slide-size` on the carousel or a slide).
    defaultStyle: { flex: "0 0 var(--rv-carousel-slide-size, 100%)", minWidth: "0", minHeight: "0" } as StyleObject,
  });
  const dom = globalDOMProps(props, ["style", "render"]);
  const tabs = parts.tabs;
  const ownLabel = props["aria-label"];
  const labelledBy = props["aria-labelledby"];
  const roleDescription = props["aria-roledescription"] ?? "slide";
  const ref = props.ref;
  const label = {
    text: () => {
      if (ownLabel !== undefined) return read(ownLabel);
      if (tabs && !labelledBy) return undefined;
      const count = state.slideCount();
      return count ? `${slide.index() + 1} of ${count}` : undefined;
    },
    labelledBy: () => labelledBy ?? (tabs ? carouselTabId(state, snapOfIndex(state, slide.index())) : undefined),
  };
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: ref as never,
        id: () => carouselSlideId(state, slide.index()),
        role: tabs ? "tabpanel" : "group",
        "aria-roledescription": roleDescription,
        "aria-label": () => label.text(),
        "aria-labelledby": () => label.labelledBy(),
        class: () => rp.class(),
        style: () => rp.style(),
        "data-index": () => slide.index(),
        "data-snapped": () => dataBool(values.isSnapped()),
        "data-in-view": () => dataBool(values.isInView()),
        children: () => rp.children(),
      } as never,
      values,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      id={carouselSlideId(state, slide.index())}
      role={tabs ? "tabpanel" : "group"}
      aria-roledescription={roleDescription}
      aria-label={label.text()}
      aria-labelledby={label.labelledBy()}
      class={rp.class()}
      style={rp.style()}
      data-index={slide.index()}
      data-snapped={dataBool(values.isSnapped())}
      data-in-view={dataBool(values.isInView())}
    >
      {rp.children()}
    </div>
  );
}

function snapOfIndex(state: CarouselState, index: number): number {
  const registry = state.slideRegistry();
  const snap = registry.findIndex((group) => group.includes(index));
  if (snap >= 0) return snap;
  const n = state.options.slidesToScroll;
  return Math.floor(index / (typeof n === "number" && n > 0 ? n : 1));
}

// --- Previous / Next ---

export interface CarouselButtonProps extends Omit<ButtonProps, "isDisabled"> {
  /** Disabled (default: no previous / next snap). */
  isDisabled?: MaybeAccessor<boolean | undefined>;
}

/** Scrolls to the previous snap (cdk `Button`; disabled without a previous snap). Default label "Previous slide". */
export function CarouselPrevious(props: CarouselButtonProps) {
  const { state } = useCarousel("CarouselPrevious");
  const { isDisabled, onPress, ...rest } = props;
  const label = props["aria-label"] ?? (props["aria-labelledby"] ? undefined : "Previous slide");
  return (
    <Button
      class="rv-CarouselPrevious"
      {...(rest as ButtonProps)}
      aria-label={label}
      aria-controls={props["aria-controls"] ?? carouselViewportId(state)}
      isDisabled={() => (isDisabled !== undefined ? !!read(isDisabled) : !state.canScrollPrev())}
      onPress={(event) => {
        carouselScrollPrev(state);
        onPress?.(event);
      }}
    />
  );
}

/** Scrolls to the next snap (cdk `Button`; disabled without a next snap). Default label "Next slide". */
export function CarouselNext(props: CarouselButtonProps) {
  const { state } = useCarousel("CarouselNext");
  const { isDisabled, onPress, ...rest } = props;
  const label = props["aria-label"] ?? (props["aria-labelledby"] ? undefined : "Next slide");
  return (
    <Button
      class="rv-CarouselNext"
      {...(rest as ButtonProps)}
      aria-label={label}
      aria-controls={props["aria-controls"] ?? carouselViewportId(state)}
      isDisabled={() => (isDisabled !== undefined ? !!read(isDisabled) : !state.canScrollNext())}
      onPress={(event) => {
        carouselScrollNext(state);
        onPress?.(event);
      }}
    />
  );
}

// --- Rotation control ---

export interface CarouselRotationControlProps extends ButtonProps {
  /** Label while rotating. @default "Stop automatic slide show" */
  stopLabel?: string;
  /** Label while stopped. @default "Start automatic slide show" */
  startLabel?: string;
}

/** APG rotation control: stops / starts autoplay or auto scroll; its label says what a press does. */
export function CarouselRotationControl(props: CarouselRotationControlProps) {
  const { state } = useCarousel("CarouselRotationControl");
  const { stopLabel = "Stop automatic slide show", startLabel = "Start automatic slide show", onPress, ...rest } = props;
  return (
    <Button
      class="rv-CarouselRotationControl"
      {...(rest as ButtonProps)}
      aria-label={() => (isRotating(state) ? stopLabel : startLabel)}
      aria-controls={props["aria-controls"] ?? carouselViewportId(state)}
      data-rotating={dataBool(isRotating(state))}
      onPress={(event) => {
        toggleRotation(state);
        onPress?.(event);
      }}
    />
  );
}

// --- Dots (APG tab picker) ---

export interface CarouselDotsProps
  extends Omit<RenderProps<CarouselRenderProps>, "children">, DOMRenderProps<"div", CarouselRenderProps>, Omit<GlobalDOMAttributes<HTMLDivElement>, "style"> {
  /** One element per snap (default `<CarouselDot index={index} />`). */
  children?: (index: number) => Content;
  /** @default "Choose slide to display" */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-CarouselDots'
   */
  class?: ClassNameOrFunction<CarouselRenderProps>;
  ref?: RefValue<HTMLDivElement>;
}

/** Slide picker: an APG tab list, one tab per snap (arrows / Home / End move and select). */
export function CarouselDots(props: CarouselDotsProps) {
  const { state } = useCarousel("CarouselDots");
  // Static slides rendered before the dots: their count is known now (server render order).
  if (!untrack(state.isReady) && !untrack(state.slideCount) && state.refs.count) {
    const registry = estimateRegistry(state.refs.count, state.options.slidesToScroll);
    state.slideCount.set(state.refs.count);
    state.slideRegistry.set(registry);
    state.snapCount.set(Math.max(registry.length, 1));
    state.canScrollNext.set(registry.length > 1 && (!!state.options.loop || untrack(state.selectedIndex) < registry.length - 1));
  }
  const values = renderValues(state);
  const rp = renderPropsOf(props as never, { values, defaultClassName: "rv-CarouselDots" }, ["class", "style"]);
  const dom = globalDOMProps(props, ["style", "render"]);
  const children = props.children;
  const label = props["aria-label"] ?? (props["aria-labelledby"] ? undefined : "Choose slide to display");
  const labelledBy = props["aria-labelledby"];
  const orientation = state.options.axis === "y" ? "vertical" : "horizontal";
  const keys = carouselTabsKeys(state);
  const ref = props.ref;
  const snaps = { list: () => Array.from({ length: state.snapCount() }, (_, i) => i) };
  const content = (): Content =>
    (
      <For each={snaps.list} by={(i: number) => i}>
        {(index) => (children ? children(untrack(index)) : <CarouselDot index={untrack(index)} />)}
      </For>
    ) as Content;
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: ref as never,
        role: "tablist",
        "aria-label": label,
        "aria-labelledby": labelledBy,
        "aria-orientation": orientation,
        class: () => rp.class(),
        style: () => rp.style(),
        "data-orientation": orientation,
        "data-rk": keys,
        onKeyDown: (event: KeyboardEvent) => carouselTabsKeyDown(event, state),
        children: () => content(),
      } as never,
      values,
    );
  return (
    <div
      {...dom}
      ref={ref as never}
      role="tablist"
      aria-label={label}
      aria-labelledby={labelledBy}
      aria-orientation={orientation}
      class={rp.class()}
      style={rp.style()}
      data-orientation={orientation}
      data-rk={keys}
      onKeyDown={(event) => carouselTabsKeyDown(event, state)}
    >
      {content()}
    </div>
  );
}

export interface CarouselDotRenderProps extends CarouselRenderProps {
  /** Snap index of the dot. */
  index: () => number;
  /**
   * Whether the dot's snap is selected.
   *
   * @selector [data-selected]
   */
  isSelected: () => boolean;
}

export interface CarouselDotProps
  extends RenderProps<CarouselDotRenderProps>, DOMRenderProps<"button", CarouselDotRenderProps>, Omit<GlobalDOMAttributes<HTMLButtonElement>, "style"> {
  /** Snap index. */
  index: number;
  /** Accessible name. @default "Slide <n>" */
  "aria-label"?: string;
  /**
   * The CSS class for the element. A function may be provided to compute the class based on component state.
   *
   * @default 'rv-CarouselDot'
   */
  class?: ClassNameOrFunction<CarouselDotRenderProps>;
  ref?: RefValue<HTMLButtonElement>;
}

const DOT_OWNED = ["style", "render", "onClick"] as const;

/** One tab of `CarouselDots`: selects its snap (`aria-selected`, roving `tabindex`, `aria-controls` = its slides). */
export function CarouselDot(props: CarouselDotProps) {
  const { state } = useCarousel("CarouselDot");
  const index = props.index;
  const values: CarouselDotRenderProps = { ...renderValues(state), index: () => index, isSelected: () => state.selectedIndex() === index };
  const rp = renderPropsOf(props, { values, defaultClassName: "rv-CarouselDot" });
  const dom = globalDOMProps(props, DOT_OWNED);
  const userClick = props.onClick as ((e: MouseEvent) => void) | undefined;
  const label = props["aria-label"] ?? `Slide ${index + 1}`;
  const ref = props.ref;
  const controls = {
    ids: () =>
      (state.slideRegistry()[index] ?? estimateRegistry(state.slideCount(), state.options.slidesToScroll)[index] ?? [])
        .map((slide) => carouselSlideId(state, slide))
        .join(" ") || undefined,
  };
  if (props.render)
    return props.render(
      {
        ...dom,
        ref: ref as never,
        type: "button",
        id: carouselTabId(state, index),
        role: "tab",
        "aria-label": label,
        "aria-selected": () => (state.selectedIndex() === index ? "true" : "false"),
        "aria-controls": () => controls.ids(),
        tabindex: () => (state.selectedIndex() === index ? 0 : -1),
        class: () => rp.class(),
        style: () => rp.style(),
        "data-selected": () => dataBool(state.selectedIndex() === index),
        onClick: (event: MouseEvent) => {
          carouselScrollTo(state, index);
          userClick?.(event);
        },
        children: () => rp.children(),
      } as never,
      values,
    );
  return (
    <button
      {...dom}
      ref={ref as never}
      type="button"
      id={carouselTabId(state, index)}
      role="tab"
      aria-label={label}
      aria-selected={state.selectedIndex() === index ? "true" : "false"}
      aria-controls={controls.ids()}
      tabIndex={state.selectedIndex() === index ? 0 : -1}
      class={rp.class()}
      style={rp.style()}
      data-selected={dataBool(state.selectedIndex() === index)}
      onClick={(event) => {
        carouselScrollTo(state, index);
        userClick?.(event);
      }}
    >
      {rp.children()}
    </button>
  );
}
