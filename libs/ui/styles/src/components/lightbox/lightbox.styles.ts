// Rivet-authored (NOT vendored from @heroui/styles; HeroUI v3.2.6 has no lightbox): tv() slots of @rivetjs/ui/lightbox in the
// vendored format. Behaviour = yet-another-react-lightbox 3.32.2 port (MIT, © Igor Danchenko) via @rivetjs/cdk/lightbox.
import "../../../out/lightbox.css";
import type {VariantProps} from "tailwind-variants";

import {tv} from "../../utils/tv.ts";

export const lightboxVariants = tv({
  defaultVariants: {
    backdrop: "opaque",
  },
  slots: {
    backdrop: "lightbox__backdrop",
    base: "lightbox",
    button: "lightbox__button",
    captions: "lightbox__captions",
    captionsDescription: "lightbox__captions-description",
    captionsTitle: "lightbox__captions-title",
    carousel: "lightbox__carousel",
    container: "lightbox__container",
    counter: "lightbox__counter",
    embed: "lightbox__embed",
    embedPoster: "lightbox__embed-poster",
    image: "lightbox__image",
    inline: "lightbox__inline",
    next: "lightbox__next",
    pdf: "lightbox__pdf",
    pdfFallback: "lightbox__pdf-fallback",
    placeholder: "lightbox__placeholder",
    previous: "lightbox__previous",
    slide: "lightbox__slide",
    thumbnail: "lightbox__thumbnail",
    thumbnailIcon: "lightbox__thumbnail-icon",
    thumbnails: "lightbox__thumbnails",
    toolbar: "lightbox__toolbar",
    video: "lightbox__video",
  },
  variants: {
    backdrop: {
      blur: {
        backdrop: "lightbox__backdrop--blur",
      },
      opaque: {
        backdrop: "lightbox__backdrop--opaque",
      },
    },
  },
});

export type LightboxVariants = VariantProps<typeof lightboxVariants>;
