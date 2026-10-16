// Ported from embla-carousel (packages/embla-carousel/src/components/Options.ts, v8.6.0), MIT, © David Jerleke.
// Rivet: TypeScript module specifiers (`.ts`, `import type`), `as` casts (erasable syntax), formatting; otherwise verbatim.
import type { AlignmentOptionType } from "./Alignment.ts";
import type { AxisDirectionOptionType, AxisOptionType } from "./Axis.ts";
import type { SlidesToScrollOptionType } from "./SlidesToScroll.ts";
import type { ScrollContainOptionType } from "./ScrollContain.ts";
import type { DragHandlerOptionType } from "./DragHandler.ts";
import type { ResizeHandlerOptionType } from "./ResizeHandler.ts";
import type { SlidesHandlerOptionType } from "./SlidesHandler.ts";
import type { SlidesInViewOptionsType } from "./SlidesInView.ts";
import type { FocusHandlerOptionType } from "./SlideFocus.ts";

export type LooseOptionsType = {
  [key: string]: unknown;
};

export type CreateOptionsType<Type extends LooseOptionsType> = Type & {
  active: boolean;
  breakpoints: {
    [key: string]: Omit<Partial<CreateOptionsType<Type>>, "breakpoints">;
  };
};

export type OptionsType = CreateOptionsType<{
  align: AlignmentOptionType;
  axis: AxisOptionType;
  container: string | HTMLElement | null;
  slides: string | HTMLElement[] | NodeListOf<HTMLElement> | null;
  containScroll: ScrollContainOptionType;
  direction: AxisDirectionOptionType;
  slidesToScroll: SlidesToScrollOptionType;
  dragFree: boolean;
  dragThreshold: number;
  inViewThreshold: SlidesInViewOptionsType;
  loop: boolean;
  skipSnaps: boolean;
  duration: number;
  startIndex: number;
  watchDrag: DragHandlerOptionType;
  watchResize: ResizeHandlerOptionType;
  watchSlides: SlidesHandlerOptionType;
  watchFocus: FocusHandlerOptionType;
}>;

export const defaultOptions: OptionsType = {
  align: "center",
  axis: "x",
  container: null,
  slides: null,
  containScroll: "trimSnaps",
  direction: "ltr",
  slidesToScroll: 1,
  inViewThreshold: 0,
  breakpoints: {},
  dragFree: false,
  dragThreshold: 10,
  loop: false,
  skipSnaps: false,
  duration: 25,
  startIndex: 0,
  active: true,
  watchDrag: true,
  watchResize: true,
  watchSlides: true,
  watchFocus: true,
};

export type EmblaOptionsType = Partial<OptionsType>;
