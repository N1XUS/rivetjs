// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no lightbox): compound `Lightbox` in the HeroUI index.ts shape over
// `@rivetjs/cdk/lightbox` (yet-another-react-lightbox 3.32.2 port, MIT, © Igor Danchenko); styles Rivet-authored in `styles/`.
// Plugin parts (`LightboxZoomIn`, `LightboxThumbnails`, …) are named exports only, not compound statics: an unused plugin
// tree-shakes (a compound static would keep every plugin alive with the root).
import {
  LightboxButton,
  LightboxClose,
  LightboxImage,
  LightboxMedia,
  LightboxNext,
  LightboxPrevious,
  LightboxRoot,
  LightboxSlides,
  LightboxToolbar,
} from "./lightbox.tsx";
import type { LightboxButtonProps, LightboxImageProps, LightboxMediaProps, LightboxRootProps, LightboxSlidesProps, LightboxToolbarProps } from "./lightbox.tsx";

/* -------------------------------------------------------------------------------------------------
 * Compound Component
 * -----------------------------------------------------------------------------------------------*/
export const Lightbox = Object.assign(LightboxRoot, {
  Root: LightboxRoot,
  Slides: LightboxSlides,
  Media: LightboxMedia,
  Image: LightboxImage,
  Toolbar: LightboxToolbar,
  Button: LightboxButton,
  Close: LightboxClose,
  Previous: LightboxPrevious,
  Next: LightboxNext,
});

export type Lightbox = {
  Props: LightboxRootProps;
  RootProps: LightboxRootProps;
  SlidesProps: LightboxSlidesProps;
  MediaProps: LightboxMediaProps;
  ImageProps: LightboxImageProps;
  ToolbarProps: LightboxToolbarProps;
  ButtonProps: LightboxButtonProps;
};

/* -------------------------------------------------------------------------------------------------
 * Named Component
 * -----------------------------------------------------------------------------------------------*/
export { LightboxButton, LightboxClose, LightboxImage, LightboxMedia, LightboxNext, LightboxPrevious, LightboxRoot, LightboxSlides, LightboxToolbar };

export type {
  LightboxButtonProps,
  LightboxImageProps,
  LightboxMediaProps,
  LightboxRootProps,
  LightboxRootProps as LightboxProps,
  LightboxSlidesProps,
  LightboxToolbarProps,
} from "./lightbox.tsx";

/* -------------------------------------------------------------------------------------------------
 * Plugin parts (named only)
 * -----------------------------------------------------------------------------------------------*/
export {
  LightboxCaptions,
  LightboxCaptionsToggle,
  LightboxCounter,
  LightboxDownload,
  LightboxFullscreen,
  LightboxInline,
  LightboxShare,
  LightboxSlideshow,
  LightboxThumbnails,
  LightboxThumbnailsToggle,
  LightboxZoom,
  LightboxZoomIn,
  LightboxZoomOut,
} from "./plugins.tsx";

export type {
  LightboxCaptionsProps,
  LightboxCaptionsToggleProps,
  LightboxCounterProps,
  LightboxDownloadProps,
  LightboxFullscreenProps,
  LightboxInlineProps,
  LightboxShareProps,
  LightboxSlideshowProps,
  LightboxThumbnailsProps,
  LightboxThumbnailsToggleProps,
  LightboxZoomButtonProps,
  LightboxZoomProps,
} from "./plugins.tsx";

/* Slide data + state helpers (cdk) */
export type {
  LightboxSlide,
  LightboxSlideCustom,
  LightboxSlideEmbed,
  LightboxSlideImage,
  LightboxSlidePdf,
  LightboxSlideVideo,
  LightboxState,
} from "@rivetjs/cdk/lightbox";

/* -------------------------------------------------------------------------------------------------
 * Variants
 * -----------------------------------------------------------------------------------------------*/
export { lightboxVariants } from "../../../styles/src/components/lightbox/index.ts";

export type { LightboxVariants } from "../../../styles/src/components/lightbox/index.ts";
