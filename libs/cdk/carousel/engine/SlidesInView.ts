// Ported from embla-carousel (packages/embla-carousel/src/components/SlidesInView.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { EventHandlerType } from "./EventHandler.ts";
import { objectKeys } from "./utils.ts";

type IntersectionEntryMapType = {
  [key: number]: IntersectionObserverEntry;
};

export type SlidesInViewOptionsType = IntersectionObserverInit["threshold"];

export type SlidesInViewType = {
  init: () => void;
  destroy: () => void;
  get: (inView?: boolean) => number[];
};

export function SlidesInView(
  container: HTMLElement,
  slides: HTMLElement[],
  eventHandler: EventHandlerType,
  threshold: SlidesInViewOptionsType,
): SlidesInViewType {
  const intersectionEntryMap: IntersectionEntryMapType = {};
  let inViewCache: number[] | null = null;
  let notInViewCache: number[] | null = null;
  let intersectionObserver: IntersectionObserver;
  let destroyed = false;

  function init(): void {
    intersectionObserver = new IntersectionObserver(
      (entries) => {
        if (destroyed) return;

        entries.forEach((entry) => {
          const index = slides.indexOf(entry.target as HTMLElement);
          intersectionEntryMap[index] = entry;
        });

        inViewCache = null;
        notInViewCache = null;
        eventHandler.emit("slidesInView");
      },
      {
        root: container.parentElement,
        threshold,
      },
    );

    slides.forEach((slide) => intersectionObserver.observe(slide));
  }

  function destroy(): void {
    if (intersectionObserver) intersectionObserver.disconnect();
    destroyed = true;
  }

  function createInViewList(inView: boolean): number[] {
    return objectKeys(intersectionEntryMap).reduce((list: number[], slideIndex) => {
      const index = parseInt(slideIndex);
      const { isIntersecting } = intersectionEntryMap[index];
      const inViewMatch = inView && isIntersecting;
      const notInViewMatch = !inView && !isIntersecting;

      if (inViewMatch || notInViewMatch) list.push(index);
      return list;
    }, []);
  }

  function get(inView: boolean = true): number[] {
    if (inView && inViewCache) return inViewCache;
    if (!inView && notInViewCache) return notInViewCache;

    const slideIndexes = createInViewList(inView);

    if (inView) inViewCache = slideIndexes;
    if (!inView) notInViewCache = slideIndexes;

    return slideIndexes;
  }

  const self: SlidesInViewType = {
    init,
    destroy,
    get,
  };

  return self;
}
