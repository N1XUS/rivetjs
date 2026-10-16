// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no carousel): compound `Carousel` in the HeroUI index.ts shape over
// `@rivetjs/cdk/carousel` (embla-carousel 8.6.0 port, MIT, © David Jerleke); styles Rivet-authored in `styles/`.
import {
  CarouselContent,
  CarouselCounter,
  CarouselDot,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselRoot,
  CarouselRotationControl,
  CarouselThumbnail,
  CarouselThumbnails,
} from "./carousel.tsx";
import type {
  CarouselContentProps,
  CarouselControlProps,
  CarouselCounterProps,
  CarouselDotProps,
  CarouselDotsProps,
  CarouselItemProps,
  CarouselRootProps,
  CarouselRotationControlProps,
  CarouselThumbnailProps,
  CarouselThumbnailsProps,
} from "./carousel.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Carousel = Object.assign(CarouselRoot, {
  Root: CarouselRoot,
  Content: CarouselContent,
  Item: CarouselItem,
  Previous: CarouselPrevious,
  Next: CarouselNext,
  RotationControl: CarouselRotationControl,
  Dots: CarouselDots,
  Dot: CarouselDot,
  Thumbnails: CarouselThumbnails,
  Thumbnail: CarouselThumbnail,
  Counter: CarouselCounter,
});

export type Carousel = {
  Props: CarouselRootProps;
  RootProps: CarouselRootProps;
  ContentProps: CarouselContentProps;
  ItemProps: CarouselItemProps;
  PreviousProps: CarouselControlProps;
  NextProps: CarouselControlProps;
  RotationControlProps: CarouselRotationControlProps;
  DotsProps: CarouselDotsProps;
  DotProps: CarouselDotProps;
  ThumbnailsProps: CarouselThumbnailsProps;
  ThumbnailProps: CarouselThumbnailProps;
  CounterProps: CarouselCounterProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export {
  CarouselContent,
  CarouselCounter,
  CarouselDot,
  CarouselDots,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  CarouselRoot,
  CarouselRotationControl,
  CarouselThumbnail,
  CarouselThumbnails,
};

export type {
  CarouselOrientation,
  CarouselRootProps,
  CarouselRootProps as CarouselProps,
  CarouselContentProps,
  CarouselItemProps,
  CarouselControlProps,
  CarouselRotationControlProps,
  CarouselDotsProps,
  CarouselDotProps,
  CarouselThumbnailsProps,
  CarouselThumbnailProps,
  CarouselCounterProps,
} from "./carousel.tsx";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { carouselVariants } from "../../../styles/src/components/carousel/index.ts";

export type { CarouselVariants } from "../../../styles/src/components/carousel/index.ts";
