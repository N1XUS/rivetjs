// Ported from embla-carousel (packages/embla-carousel/src/components/ScrollTo.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { AnimationsType } from "./Animations.ts";
import type { CounterType } from "./Counter.ts";
import type { EventHandlerType } from "./EventHandler.ts";
import type { ScrollBodyType } from "../../motion/ScrollBody.ts";
import type { ScrollTargetType, TargetType } from "./ScrollTarget.ts";
import type { Vector1DType } from "../../motion/Vector1d.ts";

export type ScrollToType = {
  distance: (n: number, snap: boolean) => void;
  index: (n: number, direction: number) => void;
};

export function ScrollTo(
  animation: AnimationsType,
  indexCurrent: CounterType,
  indexPrevious: CounterType,
  scrollBody: ScrollBodyType,
  scrollTarget: ScrollTargetType,
  targetVector: Vector1DType,
  eventHandler: EventHandlerType,
): ScrollToType {
  function scrollTo(target: TargetType): void {
    const distanceDiff = target.distance;
    const indexDiff = target.index !== indexCurrent.get();

    targetVector.add(distanceDiff);

    if (distanceDiff) {
      if (scrollBody.duration()) {
        animation.start();
      } else {
        animation.update();
        animation.render(1);
        animation.update();
      }
    }

    if (indexDiff) {
      indexPrevious.set(indexCurrent.get());
      indexCurrent.set(target.index);
      eventHandler.emit("select");
    }
  }

  function distance(n: number, snap: boolean): void {
    const target = scrollTarget.byDistance(n, snap);
    scrollTo(target);
  }

  function index(n: number, direction: number): void {
    const targetIndex = indexCurrent.clone().set(n);
    const target = scrollTarget.byIndex(targetIndex.get(), direction);
    scrollTo(target);
  }

  const self: ScrollToType = {
    distance,
    index,
  };
  return self;
}
