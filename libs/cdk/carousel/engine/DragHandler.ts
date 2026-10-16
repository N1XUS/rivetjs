// Ported from embla-carousel (packages/embla-carousel/src/components/DragHandler.ts, v8.6.0), MIT, © David Jerleke.
// Rivet:
// - TypeScript module specifiers (`.ts`, `import type`), formatting.
// - Release physics (`snapForceBoost` / `freeForceBoost`, `forceBoost()`, the `up()` speed / friction formula) come
//   from `DragRelease` of `@rivetjs/cdk/motion` (`../../motion/DragRelease.ts`, same numbers).
// - Addition: `pointerDownEvent(evt)` runs the `mousedown` / `touchstart` listener (`downIfAllowed`) for an event the
//   engine missed — on a resumed page the component layer starts the engine inside the first pointer handler, after
//   that event already passed the viewport (`carousel/behaviour.tsx`). No-op before `init` / without `watchDrag`.
import type { EmblaCarouselType } from "./EmblaCarousel.ts";
import type { AnimationsType } from "./Animations.ts";
import type { CounterType } from "./Counter.ts";
import type { DragTrackerType, PointerEventType } from "./DragTracker.ts";
import type { EventHandlerType } from "./EventHandler.ts";
import type { AxisType } from "./Axis.ts";
import { EventStore } from "./EventStore.ts";
import type { ScrollBodyType } from "../../motion/ScrollBody.ts";
import type { ScrollTargetType } from "./ScrollTarget.ts";
import type { ScrollToType } from "./ScrollTo.ts";
import type { Vector1DType } from "../../motion/Vector1d.ts";
import type { PercentOfViewType } from "./PercentOfView.ts";
import { Limit } from "../../motion/Limit.ts";
import { DragRelease } from "../../motion/DragRelease.ts";
import { deltaAbs, isBoolean, isMouseEvent, mathAbs, mathSign, type WindowType } from "./utils.ts";

type DragHandlerCallbackType = (emblaApi: EmblaCarouselType, evt: PointerEventType) => boolean | void;

export type DragHandlerOptionType = boolean | DragHandlerCallbackType;

export type DragHandlerType = {
  init: (emblaApi: EmblaCarouselType) => void;
  destroy: () => void;
  pointerDown: () => boolean;
  pointerDownEvent: (evt: PointerEventType) => void;
};

export function DragHandler(
  axis: AxisType,
  rootNode: HTMLElement,
  ownerDocument: Document,
  ownerWindow: WindowType,
  target: Vector1DType,
  dragTracker: DragTrackerType,
  location: Vector1DType,
  animation: AnimationsType,
  scrollTo: ScrollToType,
  scrollBody: ScrollBodyType,
  scrollTarget: ScrollTargetType,
  index: CounterType,
  eventHandler: EventHandlerType,
  percentOfView: PercentOfViewType,
  dragFree: boolean,
  dragThreshold: number,
  skipSnaps: boolean,
  baseFriction: number,
  watchDrag: DragHandlerOptionType,
): DragHandlerType {
  const { cross: crossAxis, direction } = axis;
  const focusNodes = ["INPUT", "SELECT", "TEXTAREA"];
  const nonPassiveEvent = { passive: false };
  const initEvents = EventStore();
  const dragEvents = EventStore();
  const goToNextThreshold = Limit(50, 225).constrain(percentOfView.measure(20));
  const release = DragRelease(dragFree, baseFriction);

  let isMoving = false;
  let startScroll = 0;
  let startCross = 0;
  let pointerIsDown = false;
  let preventScroll = false;
  let preventClick = false;
  let isMouse = false;
  let downListener: ((evt: PointerEventType) => void) | null = null;

  function init(emblaApi: EmblaCarouselType): void {
    if (!watchDrag) return;

    function downIfAllowed(evt: PointerEventType): void {
      if (isBoolean(watchDrag) || watchDrag(emblaApi, evt)) down(evt);
    }

    downListener = downIfAllowed;
    const node = rootNode;
    initEvents
      .add(node, "dragstart", (evt) => evt.preventDefault(), nonPassiveEvent)
      .add(node, "touchmove", () => undefined, nonPassiveEvent)
      .add(node, "touchend", () => undefined)
      .add(node, "touchstart", downIfAllowed)
      .add(node, "mousedown", downIfAllowed)
      .add(node, "touchcancel", up)
      .add(node, "contextmenu", up)
      .add(node, "click", click, true);
  }

  function destroy(): void {
    downListener = null;
    initEvents.clear();
    dragEvents.clear();
  }

  function addDragEvents(): void {
    const node = isMouse ? ownerDocument : rootNode;
    dragEvents.add(node, "touchmove", move, nonPassiveEvent).add(node, "touchend", up).add(node, "mousemove", move, nonPassiveEvent).add(node, "mouseup", up);
  }

  function isFocusNode(node: Element): boolean {
    const nodeName = node.nodeName || "";
    return focusNodes.includes(nodeName);
  }

  function forceBoost(): number {
    return release.forceBoost(isMouse);
  }

  function allowedForce(force: number, targetChanged: boolean): number {
    const next = index.add(mathSign(force) * -1);
    const baseForce = scrollTarget.byDistance(force, !dragFree).distance;

    if (dragFree || mathAbs(force) < goToNextThreshold) return baseForce;
    if (skipSnaps && targetChanged) return baseForce * 0.5;

    return scrollTarget.byIndex(next.get(), 0).distance;
  }

  function down(evt: PointerEventType): void {
    const isMouseEvt = isMouseEvent(evt, ownerWindow);
    isMouse = isMouseEvt;
    preventClick = dragFree && isMouseEvt && !evt.buttons && isMoving;
    isMoving = deltaAbs(target.get(), location.get()) >= 2;

    if (isMouseEvt && evt.button !== 0) return;
    if (isFocusNode(evt.target as Element)) return;

    pointerIsDown = true;
    dragTracker.pointerDown(evt);
    scrollBody.useFriction(0).useDuration(0);
    target.set(location);
    addDragEvents();
    startScroll = dragTracker.readPoint(evt);
    startCross = dragTracker.readPoint(evt, crossAxis);
    eventHandler.emit("pointerDown");
  }

  function move(evt: PointerEventType): void {
    const isTouchEvt = !isMouseEvent(evt, ownerWindow);
    if (isTouchEvt && evt.touches.length >= 2) return up(evt);

    const lastScroll = dragTracker.readPoint(evt);
    const lastCross = dragTracker.readPoint(evt, crossAxis);
    const diffScroll = deltaAbs(lastScroll, startScroll);
    const diffCross = deltaAbs(lastCross, startCross);

    if (!preventScroll && !isMouse) {
      if (!evt.cancelable) return up(evt);
      preventScroll = diffScroll > diffCross;
      if (!preventScroll) return up(evt);
    }
    const diff = dragTracker.pointerMove(evt);
    if (diffScroll > dragThreshold) preventClick = true;

    scrollBody.useFriction(0.3).useDuration(0.75);
    animation.start();
    target.add(direction(diff));
    evt.preventDefault();
  }

  function up(evt: PointerEventType): void {
    const currentLocation = scrollTarget.byDistance(0, false);
    const targetChanged = currentLocation.index !== index.get();
    const rawForce = dragTracker.pointerUp(evt) * forceBoost();
    const force = allowedForce(direction(rawForce), targetChanged);
    const { duration: speed, friction } = release.settle(rawForce, force);

    preventScroll = false;
    pointerIsDown = false;
    dragEvents.clear();
    scrollBody.useDuration(speed).useFriction(friction);
    scrollTo.distance(force, !dragFree);
    isMouse = false;
    eventHandler.emit("pointerUp");
  }

  function click(evt: MouseEvent): void {
    if (preventClick) {
      evt.stopPropagation();
      evt.preventDefault();
      preventClick = false;
    }
  }

  function pointerDown(): boolean {
    return pointerIsDown;
  }

  function pointerDownEvent(evt: PointerEventType): void {
    if (downListener) downListener(evt);
  }

  const self: DragHandlerType = {
    init,
    destroy,
    pointerDown,
    pointerDownEvent,
  };
  return self;
}
