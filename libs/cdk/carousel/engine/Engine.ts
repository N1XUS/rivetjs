// Ported from embla-carousel (packages/embla-carousel/src/components/Engine.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import { Alignment } from "./Alignment.ts";
import { Animations, type AnimationsType, type AnimationsUpdateType, type AnimationsRenderType } from "./Animations.ts";
import { Axis, type AxisType } from "./Axis.ts";
import { Counter, type CounterType } from "./Counter.ts";
import { DragHandler, type DragHandlerType } from "./DragHandler.ts";
import { DragTracker } from "./DragTracker.ts";
import type { EventHandlerType } from "./EventHandler.ts";
import { EventStore, type EventStoreType } from "./EventStore.ts";
import type { LimitType } from "../../motion/Limit.ts";
import { type NodeRectType, NodeRects } from "./NodeRects.ts";
import type { OptionsType } from "./Options.ts";
import { PercentOfView, type PercentOfViewType } from "./PercentOfView.ts";
import { ResizeHandler, type ResizeHandlerType } from "./ResizeHandler.ts";
import { ScrollBody, type ScrollBodyType } from "../../motion/ScrollBody.ts";
import { ScrollBounds, type ScrollBoundsType } from "./ScrollBounds.ts";
import { ScrollContain } from "./ScrollContain.ts";
import { ScrollLimit } from "./ScrollLimit.ts";
import { ScrollLooper, type ScrollLooperType } from "./ScrollLooper.ts";
import { ScrollProgress, type ScrollProgressType } from "./ScrollProgress.ts";
import { ScrollSnaps } from "./ScrollSnaps.ts";
import { SlideRegistry, type SlideRegistryType } from "./SlideRegistry.ts";
import { ScrollTarget, type ScrollTargetType } from "./ScrollTarget.ts";
import { ScrollTo, type ScrollToType } from "./ScrollTo.ts";
import { SlideFocus, type SlideFocusType } from "./SlideFocus.ts";
import { SlideLooper, type SlideLooperType } from "./SlideLooper.ts";
import { SlidesHandler, type SlidesHandlerType } from "./SlidesHandler.ts";
import { SlidesInView, type SlidesInViewType } from "./SlidesInView.ts";
import { SlideSizes } from "./SlideSizes.ts";
import { SlidesToScroll, type SlidesToScrollType } from "./SlidesToScroll.ts";
import { Translate, type TranslateType } from "./Translate.ts";
import { arrayKeys, arrayLast, arrayLastIndex, type WindowType } from "./utils.ts";
import { Vector1D, type Vector1DType } from "../../motion/Vector1d.ts";

export type EngineType = {
  ownerDocument: Document;
  ownerWindow: WindowType;
  eventHandler: EventHandlerType;
  axis: AxisType;
  animation: AnimationsType;
  scrollBounds: ScrollBoundsType;
  scrollLooper: ScrollLooperType;
  scrollProgress: ScrollProgressType;
  index: CounterType;
  indexPrevious: CounterType;
  limit: LimitType;
  location: Vector1DType;
  offsetLocation: Vector1DType;
  previousLocation: Vector1DType;
  options: OptionsType;
  percentOfView: PercentOfViewType;
  scrollBody: ScrollBodyType;
  dragHandler: DragHandlerType;
  eventStore: EventStoreType;
  slideLooper: SlideLooperType;
  slidesInView: SlidesInViewType;
  slidesToScroll: SlidesToScrollType;
  target: Vector1DType;
  translate: TranslateType;
  resizeHandler: ResizeHandlerType;
  slidesHandler: SlidesHandlerType;
  scrollTo: ScrollToType;
  scrollTarget: ScrollTargetType;
  scrollSnapList: number[];
  scrollSnaps: number[];
  slideIndexes: number[];
  slideFocus: SlideFocusType;
  slideRegistry: SlideRegistryType["slideRegistry"];
  containerRect: NodeRectType;
  slideRects: NodeRectType[];
};

export function Engine(
  root: HTMLElement,
  container: HTMLElement,
  slides: HTMLElement[],
  ownerDocument: Document,
  ownerWindow: WindowType,
  options: OptionsType,
  eventHandler: EventHandlerType,
): EngineType {
  // Options
  const {
    align,
    axis: scrollAxis,
    direction,
    startIndex,
    loop,
    duration,
    dragFree,
    dragThreshold,
    inViewThreshold,
    slidesToScroll: groupSlides,
    skipSnaps,
    containScroll,
    watchResize,
    watchSlides,
    watchDrag,
    watchFocus,
  } = options;

  // Measurements
  const pixelTolerance = 2;
  const nodeRects = NodeRects();
  const containerRect = nodeRects.measure(container);
  const slideRects = slides.map(nodeRects.measure);
  const axis = Axis(scrollAxis, direction);
  const viewSize = axis.measureSize(containerRect);
  const percentOfView = PercentOfView(viewSize);
  const alignment = Alignment(align, viewSize);
  const containSnaps = !loop && !!containScroll;
  const readEdgeGap = loop || !!containScroll;
  const { slideSizes, slideSizesWithGaps, startGap, endGap } = SlideSizes(axis, containerRect, slideRects, slides, readEdgeGap, ownerWindow);
  const slidesToScroll = SlidesToScroll(axis, viewSize, groupSlides, loop, containerRect, slideRects, startGap, endGap, pixelTolerance);
  const { snaps, snapsAligned } = ScrollSnaps(axis, alignment, containerRect, slideRects, slidesToScroll);
  const contentSize = -arrayLast(snaps) + arrayLast(slideSizesWithGaps);
  const { snapsContained, scrollContainLimit } = ScrollContain(viewSize, contentSize, snapsAligned, containScroll, pixelTolerance);
  const scrollSnaps = containSnaps ? snapsContained : snapsAligned;
  const { limit } = ScrollLimit(contentSize, scrollSnaps, loop);

  // Indexes
  const index = Counter(arrayLastIndex(scrollSnaps), startIndex, loop);
  const indexPrevious = index.clone();
  const slideIndexes = arrayKeys(slides);

  // Animation
  const update: AnimationsUpdateType = ({ dragHandler, scrollBody, scrollBounds, options: { loop } }) => {
    if (!loop) scrollBounds.constrain(dragHandler.pointerDown());
    scrollBody.seek();
  };

  const render: AnimationsRenderType = (
    {
      scrollBody,
      translate,
      location,
      offsetLocation,
      previousLocation,
      scrollLooper,
      slideLooper,
      dragHandler,
      animation,
      eventHandler,
      scrollBounds,
      options: { loop },
    },
    alpha,
  ) => {
    const shouldSettle = scrollBody.settled();
    const withinBounds = !scrollBounds.shouldConstrain();
    const hasSettled = loop ? shouldSettle : shouldSettle && withinBounds;
    const hasSettledAndIdle = hasSettled && !dragHandler.pointerDown();

    if (hasSettledAndIdle) animation.stop();

    const interpolatedLocation = location.get() * alpha + previousLocation.get() * (1 - alpha);

    offsetLocation.set(interpolatedLocation);

    if (loop) {
      scrollLooper.loop(scrollBody.direction());
      slideLooper.loop();
    }

    translate.to(offsetLocation.get());

    if (hasSettledAndIdle) eventHandler.emit("settle");
    if (!hasSettled) eventHandler.emit("scroll");
  };

  const animation = Animations(
    ownerDocument,
    ownerWindow,
    () => update(engine),
    (alpha: number) => render(engine, alpha),
  );

  // Shared
  const friction = 0.68;
  const startLocation = scrollSnaps[index.get()];
  const location = Vector1D(startLocation);
  const previousLocation = Vector1D(startLocation);
  const offsetLocation = Vector1D(startLocation);
  const target = Vector1D(startLocation);
  const scrollBody = ScrollBody(location, offsetLocation, previousLocation, target, duration, friction);
  const scrollTarget = ScrollTarget(loop, scrollSnaps, contentSize, limit, target);
  const scrollTo = ScrollTo(animation, index, indexPrevious, scrollBody, scrollTarget, target, eventHandler);
  const scrollProgress = ScrollProgress(limit);
  const eventStore = EventStore();
  const slidesInView = SlidesInView(container, slides, eventHandler, inViewThreshold);
  const { slideRegistry } = SlideRegistry(containSnaps, containScroll, scrollSnaps, scrollContainLimit, slidesToScroll, slideIndexes);
  const slideFocus = SlideFocus(root, slides, slideRegistry, scrollTo, scrollBody, eventStore, eventHandler, watchFocus);

  // Engine
  const engine: EngineType = {
    ownerDocument,
    ownerWindow,
    eventHandler,
    containerRect,
    slideRects,
    animation,
    axis,
    dragHandler: DragHandler(
      axis,
      root,
      ownerDocument,
      ownerWindow,
      target,
      DragTracker(axis, ownerWindow),
      location,
      animation,
      scrollTo,
      scrollBody,
      scrollTarget,
      index,
      eventHandler,
      percentOfView,
      dragFree,
      dragThreshold,
      skipSnaps,
      friction,
      watchDrag,
    ),
    eventStore,
    percentOfView,
    index,
    indexPrevious,
    limit,
    location,
    offsetLocation,
    previousLocation,
    options,
    resizeHandler: ResizeHandler(container, eventHandler, ownerWindow, slides, axis, watchResize, nodeRects),
    scrollBody,
    scrollBounds: ScrollBounds(limit, offsetLocation, target, scrollBody, percentOfView),
    scrollLooper: ScrollLooper(contentSize, limit, offsetLocation, [location, offsetLocation, previousLocation, target]),
    scrollProgress,
    scrollSnapList: scrollSnaps.map(scrollProgress.get),
    scrollSnaps,
    scrollTarget,
    scrollTo,
    slideLooper: SlideLooper(axis, viewSize, contentSize, slideSizes, slideSizesWithGaps, snaps, scrollSnaps, offsetLocation, slides),
    slideFocus,
    slidesHandler: SlidesHandler(container, eventHandler, watchSlides),
    slidesInView,
    slideIndexes,
    slideRegistry,
    slidesToScroll,
    target,
    translate: Translate(axis, container),
  };

  return engine;
}
