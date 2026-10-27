// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no carousel). Behaviour + motion = embla-carousel 8.6.0 port (MIT,
// © David Jerleke) with W3C APG carousel semantics through `@rivetjs/cdk/carousel`; look = HeroUI tokens and conventions
// (vendored-format tv slots in `styles/src/components/carousel/`, BEM CSS `styles/components/carousel.css`, both Rivet-authored).
// Rivet:
// - Parts map to cdk parts: `Carousel` → `Carousel` (+ `orientation` → embla `axis`), `Carousel.Content` → `CarouselViewport` >
//   `CarouselContainer` (shadcn's CarouselContent shape: `class` on the track, `viewportClass` on the viewport),
//   `Carousel.Item` → `CarouselSlide`, `Carousel.Previous` / `.Next` → `CarouselPrevious` / `CarouselNext` (HeroUI icon-only
//   `Button` classes, lucide chevrons flipped for `vertical` / RTL), `Carousel.Dots` / `.Dot` and `Carousel.Thumbnails` /
//   `.Thumbnail` → `CarouselDots` / `CarouselDot` (APG tab list), `Carousel.RotationControl` → `CarouselRotationControl`
//   (lucide Pause + Play, the hidden one picked by CSS on `data-rotating`: no reactive child), `Carousel.Counter` = Rivet
//   `"N / M"` text over the cdk state.
// - Slide movement is the cdk embla engine (inline transform); CSS only animates the dot pill / thumbnail emphasis.
// - `CarouselContext` (id `rv-ui-carousel`) carries plain data `{ size, orientation, placement }` (getters over the live
//   props); parts read tv slots from a module-level memo. Live `class` / `size` / `placement` → a class function for the cdk part.
// - The root chains `onSelect`: the selected thumbnail is scrolled into its strip (no layout read before the engine runs).
import { Icon } from "@rivetjs/kit/icon";
import {
  Carousel as CarouselPrimitive,
  CarouselContainer as CarouselContainerPrimitive,
  CarouselDot as CarouselDotPrimitive,
  CarouselDots as CarouselDotsPrimitive,
  CarouselNext as CarouselNextPrimitive,
  CarouselPrevious as CarouselPreviousPrimitive,
  CarouselRotationControl as CarouselRotationControlPrimitive,
  CarouselSlide as CarouselSlidePrimitive,
  CarouselStateContext,
  CarouselViewport as CarouselViewportPrimitive,
  carouselTabId,
} from "@rivetjs/cdk/carousel";
import type {
  CarouselButtonProps as CarouselButtonPrimitiveProps,
  CarouselContainerProps as CarouselContainerPrimitiveProps,
  CarouselDotProps as CarouselDotPrimitiveProps,
  CarouselDotsProps as CarouselDotsPrimitiveProps,
  CarouselProps as CarouselPrimitiveProps,
  CarouselRotationControlProps as CarouselRotationControlPrimitiveProps,
  CarouselSlideProps as CarouselSlidePrimitiveProps,
} from "@rivetjs/cdk/carousel";
import { resumedId } from "@rivetjs/cdk/id";
import { createContext, useContext } from "@rivetjs/reactivity";
import { Provider } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pause, Play } from "lucide";

import type { ButtonVariants } from "../../../styles/src/components/button/index.ts";
import { buttonVariants } from "../../../styles/src/components/button/index.ts";
import type { CarouselVariants } from "../../../styles/src/components/carousel/index.ts";
import { carouselVariants } from "../../../styles/src/components/carousel/index.ts";
import { composeTwRenderProps } from "../../utils/compose.tsx";
import { hasLiveProp, renderClass, splitLive } from "../../utils/live.tsx";

/* -------------------------------------------------------------------------------------------------
 * Carousel Context
 * -----------------------------------------------------------------------------------------------*/
type CarouselOrientation = "horizontal" | "vertical";

type CarouselContext = {
  size?: CarouselVariants["size"];
  orientation?: CarouselOrientation;
  placement?: CarouselVariants["placement"];
};

const CarouselContext = createContext<CarouselContext>({});

type CarouselSlots = ReturnType<typeof carouselVariants>;
const SLOTS: Record<string, CarouselSlots> = {};
const slotsFor = (size: string, orientation: string, placement: string): CarouselSlots =>
  (SLOTS[`${size}|${orientation}|${placement}`] ??= carouselVariants({
    orientation: orientation as CarouselOrientation,
    placement: placement as CarouselVariants["placement"],
    size: size as CarouselVariants["size"],
  }));
/** Slots of the enclosing carousel (defaults md / horizontal / inside). */
const slotsOf = (context: CarouselContext): CarouselSlots => slotsFor(context.size ?? "md", context.orientation ?? "horizontal", context.placement ?? "inside");

type ClassValue<T> = string | ((values: T) => string | undefined) | undefined;
/** `class` for a cdk part: one string on the static path, a render-prop function when a style prop is live. */
const join = (...parts: (string | undefined)[]): string => parts.filter(Boolean).join(" ");

/** Scrolls the selected thumbnail into its strip (only when the strip overflows; never scrolls the page). */
function revealThumbnail(id: string, index: number): void {
  const tab = globalThis.document?.getElementById(carouselTabId({ id } as never, index));
  const strip = tab?.parentElement;
  if (!tab || !strip || strip.getAttribute("data-slot") !== "carousel-thumbnails") return;
  const s = strip.getBoundingClientRect();
  const t = tab.getBoundingClientRect();
  const pad = 4;
  const left = t.left < s.left ? t.left - s.left - pad : t.right > s.right ? t.right - s.right + pad : 0;
  const top = t.top < s.top ? t.top - s.top - pad : t.bottom > s.bottom ? t.bottom - s.bottom + pad : 0;
  if (!left && !top) return;
  const reduce = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  strip.scrollBy({ left, top, behavior: reduce ? "auto" : "smooth" });
}

/* -------------------------------------------------------------------------------------------------
 * Carousel Root
 * -----------------------------------------------------------------------------------------------*/
interface CarouselRootProps extends Omit<CarouselPrimitiveProps, "axis">, Omit<CarouselVariants, "orientation"> {
  /**
   * Slide axis (embla `axis`: `x` / `y`); read once. A vertical carousel needs a viewport height (`--carousel-height`).
   * @default "horizontal"
   */
  orientation?: CarouselOrientation;
}

const ROOT_STYLE_PROPS = ["class", "size", "placement"] as const;

const CarouselRoot = (props: CarouselRootProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "size", "placement", "orientation", "id", "onSelect"]);
  const orientation: CarouselOrientation = local.orientation ?? "horizontal";
  const id = local.id || resumedId();
  const onSelect = local.onSelect;
  const context: CarouselContext = {
    get size() {
      return local.size ?? "md";
    },
    orientation,
    get placement() {
      return local.placement ?? "inside";
    },
  };
  const classOf = () => composeTwRenderProps(local.class as ClassValue<never>, slotsOf(context).base());
  const cls = hasLiveProp(local, ROOT_STYLE_PROPS) ? (values: never) => renderClass(classOf(), values) : classOf();
  // A function: Rivet JSX builds nodes eagerly, the cdk root (and the parts in its children) must be created inside the provider.
  const content = () => (
    <CarouselPrimitive
      data-slot="carousel"
      {...rest}
      id={id}
      axis={orientation === "vertical" ? "y" : "x"}
      class={cls as never}
      onSelect={(index: number) => {
        revealThumbnail(id, index);
        onSelect?.(index);
      }}
    >
      {local.children}
    </CarouselPrimitive>
  );

  return (
    <Provider token={CarouselContext} value={context}>
      {content()}
    </Provider>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Carousel Content (viewport + track)
 * -----------------------------------------------------------------------------------------------*/
interface CarouselContentProps<T = unknown> extends CarouselContainerPrimitiveProps<T> {
  /** Class of the clipping viewport (the drag surface) around the track. */
  viewportClass?: string;
}

const CarouselContent = <T,>(props: CarouselContentProps<T>): JSX.Element => {
  const [local, rest] = splitLive(props as CarouselContentProps<unknown>, ["children", "class", "viewportClass"]);
  const context = useContext(CarouselContext);
  const viewportClass = () => join(slotsOf(context).viewport(), local.viewportClass);
  const classOf = () => composeTwRenderProps(local.class as ClassValue<never>, slotsOf(context).content());
  const live = hasLiveProp(local, ["class", "viewportClass"]);
  const cls = live ? (values: never) => renderClass(classOf(), values) : classOf();
  const vcls = live ? () => viewportClass() : viewportClass();

  return (
    <CarouselViewportPrimitive class={vcls as never} data-slot="carousel-viewport">
      <CarouselContainerPrimitive data-slot="carousel-content" {...rest} class={cls as never}>
        {local.children as never}
      </CarouselContainerPrimitive>
    </CarouselViewportPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Carousel Item
 * -----------------------------------------------------------------------------------------------*/
type CarouselItemProps = CarouselSlidePrimitiveProps;

const CarouselItem = (props: CarouselItemProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CarouselContext);
  const classOf = () => composeTwRenderProps(local.class as ClassValue<never>, slotsOf(context).item());
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();

  return (
    <CarouselSlidePrimitive data-slot="carousel-item" {...rest} class={cls as never}>
      {local.children}
    </CarouselSlidePrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Carousel Previous / Next
 * -----------------------------------------------------------------------------------------------*/
interface CarouselControlProps extends CarouselButtonPrimitiveProps {
  /** Button variant. @default "tertiary" (on the overlay surface with `placement="inside"`) */
  variant?: ButtonVariants["variant"];
  /** Button size. @default the carousel size */
  size?: ButtonVariants["size"];
}

const CONTROL_STYLE_PROPS = ["class", "variant", "size"] as const;

const CarouselPrevious = (props: CarouselControlProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "variant", "size"]);
  const context = useContext(CarouselContext);
  const state = useContext(CarouselStateContext);
  const icon = context.orientation === "vertical" ? ChevronUp : state?.options.direction === "rtl" ? ChevronRight : ChevronLeft;
  const classOf = () =>
    composeTwRenderProps(
      local.class as ClassValue<never>,
      join(
        buttonVariants({ isIconOnly: true, size: local.size ?? context.size, variant: local.variant ?? "tertiary" }),
        slotsOf(context).control(),
        slotsOf(context).previous(),
      ),
    );
  const cls = hasLiveProp(local, CONTROL_STYLE_PROPS) ? (values: never) => renderClass(classOf(), values) : classOf();

  return (
    <CarouselPreviousPrimitive data-slot="carousel-previous" {...rest} class={cls as never}>
      {local.children ?? <Icon icon={icon} data-slot="carousel-previous-icon" />}
    </CarouselPreviousPrimitive>
  );
};

const CarouselNext = (props: CarouselControlProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "variant", "size"]);
  const context = useContext(CarouselContext);
  const state = useContext(CarouselStateContext);
  const icon = context.orientation === "vertical" ? ChevronDown : state?.options.direction === "rtl" ? ChevronLeft : ChevronRight;
  const classOf = () =>
    composeTwRenderProps(
      local.class as ClassValue<never>,
      join(
        buttonVariants({ isIconOnly: true, size: local.size ?? context.size, variant: local.variant ?? "tertiary" }),
        slotsOf(context).control(),
        slotsOf(context).next(),
      ),
    );
  const cls = hasLiveProp(local, CONTROL_STYLE_PROPS) ? (values: never) => renderClass(classOf(), values) : classOf();

  return (
    <CarouselNextPrimitive data-slot="carousel-next" {...rest} class={cls as never}>
      {local.children ?? <Icon icon={icon} data-slot="carousel-next-icon" />}
    </CarouselNextPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Carousel RotationControl
 * -----------------------------------------------------------------------------------------------*/
interface CarouselRotationControlProps extends CarouselRotationControlPrimitiveProps {
  /** Button variant. @default "tertiary" */
  variant?: ButtonVariants["variant"];
  /** Button size. @default "sm" */
  size?: ButtonVariants["size"];
}

const CarouselRotationControl = (props: CarouselRotationControlProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "variant", "size"]);
  const context = useContext(CarouselContext);
  const classOf = () =>
    composeTwRenderProps(
      local.class as ClassValue<never>,
      join(buttonVariants({ isIconOnly: true, size: local.size ?? "sm", variant: local.variant ?? "tertiary" }), slotsOf(context).rotationControl()),
    );
  const cls = hasLiveProp(local, CONTROL_STYLE_PROPS) ? (values: never) => renderClass(classOf(), values) : classOf();
  // Both icons render; CSS hides the one that does not match `data-rotating` (the label says what a press does).
  const icons = () => (
    <>
      <Icon icon={Pause} data-slot="carousel-pause-icon" />
      <Icon icon={Play} data-slot="carousel-play-icon" />
    </>
  );

  return (
    <CarouselRotationControlPrimitive data-slot="carousel-rotation-control" {...rest} class={cls as never}>
      {local.children ?? icons()}
    </CarouselRotationControlPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Carousel Dots / Dot
 * -----------------------------------------------------------------------------------------------*/
type CarouselDotProps = CarouselDotPrimitiveProps;

const CarouselDot = (props: CarouselDotProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CarouselContext);
  const classOf = () => composeTwRenderProps(local.class as ClassValue<never>, slotsOf(context).dot());
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();

  return (
    <CarouselDotPrimitive data-slot="carousel-dot" {...rest} class={cls as never}>
      {local.children}
    </CarouselDotPrimitive>
  );
};

type CarouselDotsProps = CarouselDotsPrimitiveProps;

const CarouselDots = (props: CarouselDotsProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CarouselContext);
  const classOf = () => composeTwRenderProps(local.class as ClassValue<never>, slotsOf(context).dots());
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();
  const children = local.children;

  return (
    <CarouselDotsPrimitive data-slot="carousel-dots" {...rest} class={cls as never}>
      {(index: number) => (children ? children(index) : <CarouselDot index={index} />)}
    </CarouselDotsPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Carousel Thumbnails / Thumbnail
 * -----------------------------------------------------------------------------------------------*/
type CarouselThumbnailProps = CarouselDotPrimitiveProps;

const CarouselThumbnail = (props: CarouselThumbnailProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class"]);
  const context = useContext(CarouselContext);
  const classOf = () => composeTwRenderProps(local.class as ClassValue<never>, slotsOf(context).thumbnail());
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();

  return (
    <CarouselDotPrimitive data-slot="carousel-thumbnail" {...rest} class={cls as never}>
      {local.children}
    </CarouselDotPrimitive>
  );
};

interface CarouselThumbnailsProps extends Omit<CarouselDotsPrimitiveProps, "children"> {
  /** Preview of snap `index` (an `img` covers the thumbnail), or a whole `Carousel.Thumbnail` when `custom`. */
  children: (index: number) => Content;
  /** `children` returns the `Carousel.Thumbnail` itself (custom classes / labels per thumbnail). */
  custom?: boolean;
}

const CarouselThumbnails = (props: CarouselThumbnailsProps): JSX.Element => {
  const [local, rest] = splitLive(props, ["children", "class", "custom"]);
  const context = useContext(CarouselContext);
  const classOf = () => composeTwRenderProps(local.class as ClassValue<never>, slotsOf(context).thumbnails());
  const cls = hasLiveProp(local, ["class"]) ? (values: never) => renderClass(classOf(), values) : classOf();
  const children = local.children;
  const custom = !!local.custom;

  return (
    <CarouselDotsPrimitive data-slot="carousel-thumbnails" {...rest} class={cls as never}>
      {(index: number) => (custom ? children(index) : <CarouselThumbnail index={index}>{children(index)}</CarouselThumbnail>)}
    </CarouselDotsPrimitive>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Carousel Counter
 * -----------------------------------------------------------------------------------------------*/
interface CarouselCounterProps {
  class?: string;
  id?: string;
  /** Text between the selected snap and the snap count. @default " / " */
  separator?: string;
}

const CarouselCounter = (props: CarouselCounterProps): JSX.Element => {
  const [local] = splitLive(props, ["class", "id", "separator"]);
  const context = useContext(CarouselContext);
  const state = useContext(CarouselStateContext);
  if (!state) throw new Error("<Carousel.Counter> must be rendered inside a <Carousel>.");
  const separator = local.separator ?? " / ";

  return (
    <span id={local.id} class={join(slotsOf(context).counter(), local.class)} data-slot="carousel-counter">
      {state.selectedIndex() + 1}
      {separator}
      {state.snapCount()}
    </span>
  );
};

/* -------------------------------------------------------------------------------------------------
 * Exports
 * -----------------------------------------------------------------------------------------------*/
export {
  CarouselContext,
  CarouselRoot,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  CarouselRotationControl,
  CarouselDots,
  CarouselDot,
  CarouselThumbnails,
  CarouselThumbnail,
  CarouselCounter,
};

export type {
  CarouselOrientation,
  CarouselRootProps,
  CarouselContentProps,
  CarouselItemProps,
  CarouselControlProps,
  CarouselRotationControlProps,
  CarouselDotsProps,
  CarouselDotProps,
  CarouselThumbnailsProps,
  CarouselThumbnailProps,
  CarouselCounterProps,
};
