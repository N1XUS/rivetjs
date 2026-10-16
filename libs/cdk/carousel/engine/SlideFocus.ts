// Ported from embla-carousel (packages/embla-carousel/src/components/SlideFocus.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { EmblaCarouselType } from "./EmblaCarousel.ts";
import type { EventHandlerType } from "./EventHandler.ts";
import type { EventStoreType } from "./EventStore.ts";
import type { ScrollBodyType } from "../../motion/ScrollBody.ts";
import type { ScrollToType } from "./ScrollTo.ts";
import type { SlideRegistryType } from "./SlideRegistry.ts";
import { isBoolean, isNumber } from "./utils.ts";

type FocusHandlerCallbackType = (emblaApi: EmblaCarouselType, evt: FocusEvent) => boolean | void;

export type FocusHandlerOptionType = boolean | FocusHandlerCallbackType;

export type SlideFocusType = {
  init: (emblaApi: EmblaCarouselType) => void;
};

export function SlideFocus(
  root: HTMLElement,
  slides: HTMLElement[],
  slideRegistry: SlideRegistryType["slideRegistry"],
  scrollTo: ScrollToType,
  scrollBody: ScrollBodyType,
  eventStore: EventStoreType,
  eventHandler: EventHandlerType,
  watchFocus: FocusHandlerOptionType,
): SlideFocusType {
  const focusListenerOptions = { passive: true, capture: true };
  let lastTabPressTime = 0;

  function init(emblaApi: EmblaCarouselType): void {
    if (!watchFocus) return;

    function defaultCallback(index: number): void {
      const nowTime = new Date().getTime();
      const diffTime = nowTime - lastTabPressTime;

      if (diffTime > 10) return;

      eventHandler.emit("slideFocusStart");
      root.scrollLeft = 0;

      const group = slideRegistry.findIndex((group) => group.includes(index));

      if (!isNumber(group)) return;

      scrollBody.useDuration(0);
      scrollTo.index(group, 0);

      eventHandler.emit("slideFocus");
    }

    eventStore.add(document, "keydown", registerTabPress, false);

    slides.forEach((slide, slideIndex) => {
      eventStore.add(
        slide,
        "focus",
        (evt: FocusEvent) => {
          if (isBoolean(watchFocus) || watchFocus(emblaApi, evt)) {
            defaultCallback(slideIndex);
          }
        },
        focusListenerOptions,
      );
    });
  }

  function registerTabPress(event: KeyboardEvent): void {
    if (event.code === "Tab") lastTabPressTime = new Date().getTime();
  }

  const self: SlideFocusType = {
    init,
  };
  return self;
}
