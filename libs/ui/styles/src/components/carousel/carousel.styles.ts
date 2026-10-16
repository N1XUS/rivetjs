// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no carousel): tv() slots of @rivetjs/ui/carousel in the
// vendored format. Behaviour + motion = embla-carousel 8.6.0 port (MIT, © David Jerleke) via @rivetjs/cdk/carousel.
import "../../../out/carousel.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const carouselVariants = tv({
  defaultVariants: {
    orientation: "horizontal",
    placement: "inside",
    size: "md",
  },
  slots: {
    base: "carousel",
    content: "carousel__content",
    control: "carousel__control",
    counter: "carousel__counter",
    dot: "carousel__dot",
    dots: "carousel__dots",
    item: "carousel__item",
    next: "carousel__next",
    previous: "carousel__previous",
    rotationControl: "carousel__rotation-control",
    thumbnail: "carousel__thumbnail",
    thumbnails: "carousel__thumbnails",
    viewport: "carousel__viewport",
  },
  variants: {
    orientation: {
      horizontal: {
        base: "carousel--horizontal",
      },
      vertical: {
        base: "carousel--vertical",
      },
    },
    placement: {
      inside: {
        base: "carousel--inside",
      },
      outside: {
        base: "carousel--outside",
      },
    },
    size: {
      lg: {
        base: "carousel--lg",
      },
      md: {
        base: "carousel--md",
      },
      sm: {
        base: "carousel--sm",
      },
    },
  },
});

export type CarouselVariants = VariantProps<typeof carouselVariants>;
