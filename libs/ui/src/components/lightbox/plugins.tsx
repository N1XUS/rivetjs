// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no lightbox): styled plugin parts over the
// `@rivetjs/cdk/lightbox/<plugin>` subpaths (yet-another-react-lightbox 3.32.2 port, MIT, © Igor Danchenko).
// Rivet:
// - Named exports only (not compound statics of `Lightbox`): each part imports only its own cdk plugin subpath, so an unused
//   plugin tree-shakes out of an app bundle.
// - Toggle buttons render both icons (`span[data-when=on|off]`); `lightbox.css` shows one by `aria-pressed` (no reactive child).
// - Thumbnails without an image render a lucide icon by slide type (video `Film`, embed `Play`, PDF `FileText`, else `Image`).
import { Icon } from "@rivetjs/kit/icon";
import { LightboxCaptions as LightboxCaptionsPrimitive, LightboxCaptionsToggle as LightboxCaptionsTogglePrimitive } from "@rivetjs/cdk/lightbox/captions";
import type { LightboxCaptionsProps as LightboxCaptionsPrimitiveProps, LightboxCaptionsToggleProps } from "@rivetjs/cdk/lightbox/captions";
import { LightboxCounter as LightboxCounterPrimitive } from "@rivetjs/cdk/lightbox/counter";
import type { LightboxCounterProps } from "@rivetjs/cdk/lightbox/counter";
import { LightboxDownload as LightboxDownloadPrimitive } from "@rivetjs/cdk/lightbox/download";
import type { LightboxDownloadProps } from "@rivetjs/cdk/lightbox/download";
import { LightboxFullscreen as LightboxFullscreenPrimitive } from "@rivetjs/cdk/lightbox/fullscreen";
import type { LightboxFullscreenProps } from "@rivetjs/cdk/lightbox/fullscreen";
import { LightboxInline as LightboxInlinePrimitive } from "@rivetjs/cdk/lightbox/inline";
import type { LightboxInlineProps as LightboxInlinePrimitiveProps } from "@rivetjs/cdk/lightbox/inline";
import { LightboxShare as LightboxSharePrimitive } from "@rivetjs/cdk/lightbox/share";
import type { LightboxShareProps } from "@rivetjs/cdk/lightbox/share";
import { LightboxSlideshow as LightboxSlideshowPrimitive } from "@rivetjs/cdk/lightbox/slideshow";
import type { LightboxSlideshowProps } from "@rivetjs/cdk/lightbox/slideshow";
import {
  LightboxThumbnails as LightboxThumbnailsPrimitive,
  LightboxThumbnailsToggle as LightboxThumbnailsTogglePrimitive,
} from "@rivetjs/cdk/lightbox/thumbnails";
import type { LightboxThumbnailsProps as LightboxThumbnailsPrimitiveProps, LightboxThumbnailsToggleProps } from "@rivetjs/cdk/lightbox/thumbnails";
import { LightboxZoom, LightboxZoomIn as LightboxZoomInPrimitive, LightboxZoomOut as LightboxZoomOutPrimitive } from "@rivetjs/cdk/lightbox/zoom";
import type { LightboxZoomButtonProps, LightboxZoomProps } from "@rivetjs/cdk/lightbox/zoom";
import type { JSX } from "@rivetjs/runtime/jsx-runtime";
import {
  Captions,
  CaptionsOff,
  Download,
  FileText,
  Film,
  GalleryThumbnails,
  Image as ImageIcon,
  Maximize,
  Minimize,
  Pause,
  Play,
  Share2,
  ZoomIn,
  ZoomOut,
} from "lucide";

import { LightboxNext, LightboxPrevious, LightboxSlides, lightboxButtonClass, lightboxSlots } from "./lightbox.tsx";

const join = (...parts: (string | undefined)[]): string => parts.filter(Boolean).join(" ");

/* -------------------------------------------------------------------------------------------------
 * Zoom
 * -----------------------------------------------------------------------------------------------*/
const LightboxZoomIn = (props: LightboxZoomButtonProps): JSX.Element =>
  (
    <LightboxZoomInPrimitive {...props} class={lightboxButtonClass(undefined, props.class)}>
      {props.children ?? <Icon icon={ZoomIn} data-slot="lightbox-zoom-in-icon" />}
    </LightboxZoomInPrimitive>
  ) as JSX.Element;

const LightboxZoomOut = (props: LightboxZoomButtonProps): JSX.Element =>
  (
    <LightboxZoomOutPrimitive {...props} class={lightboxButtonClass(undefined, props.class)}>
      {props.children ?? <Icon icon={ZoomOut} data-slot="lightbox-zoom-out-icon" />}
    </LightboxZoomOutPrimitive>
  ) as JSX.Element;

/* -------------------------------------------------------------------------------------------------
 * Toolbar buttons
 * -----------------------------------------------------------------------------------------------*/
const LightboxDownload = (props: LightboxDownloadProps): JSX.Element =>
  (
    <LightboxDownloadPrimitive {...props} class={lightboxButtonClass(undefined, props.class)}>
      {props.children ?? <Icon icon={Download} data-slot="lightbox-download-icon" />}
    </LightboxDownloadPrimitive>
  ) as JSX.Element;

const LightboxShare = (props: LightboxShareProps): JSX.Element =>
  (
    <LightboxSharePrimitive {...props} class={lightboxButtonClass(undefined, props.class)}>
      {props.children ?? <Icon icon={Share2} data-slot="lightbox-share-icon" />}
    </LightboxSharePrimitive>
  ) as JSX.Element;

const LightboxFullscreen = (props: LightboxFullscreenProps): JSX.Element =>
  (
    <LightboxFullscreenPrimitive {...props} class={lightboxButtonClass(undefined, props.class)}>
      {props.children ?? (
        <>
          <span data-when="off">
            <Icon icon={Maximize} data-slot="lightbox-fullscreen-enter-icon" />
          </span>
          <span data-when="on">
            <Icon icon={Minimize} data-slot="lightbox-fullscreen-exit-icon" />
          </span>
        </>
      )}
    </LightboxFullscreenPrimitive>
  ) as JSX.Element;

const LightboxSlideshow = (props: LightboxSlideshowProps): JSX.Element =>
  (
    <LightboxSlideshowPrimitive {...props} class={lightboxButtonClass(undefined, props.class)}>
      {props.children ?? (
        <>
          <span data-when="off">
            <Icon icon={Play} data-slot="lightbox-play-icon" />
          </span>
          <span data-when="on">
            <Icon icon={Pause} data-slot="lightbox-pause-icon" />
          </span>
        </>
      )}
    </LightboxSlideshowPrimitive>
  ) as JSX.Element;

const LightboxCaptionsToggle = (props: LightboxCaptionsToggleProps): JSX.Element =>
  (
    <LightboxCaptionsTogglePrimitive {...props} class={lightboxButtonClass(undefined, props.class)}>
      {props.children ?? (
        <>
          <span data-when="off">
            <Icon icon={CaptionsOff} data-slot="lightbox-captions-off-icon" />
          </span>
          <span data-when="on">
            <Icon icon={Captions} data-slot="lightbox-captions-icon" />
          </span>
        </>
      )}
    </LightboxCaptionsTogglePrimitive>
  ) as JSX.Element;

const LightboxThumbnailsToggle = (props: LightboxThumbnailsToggleProps): JSX.Element =>
  (
    <LightboxThumbnailsTogglePrimitive {...props} class={lightboxButtonClass(undefined, props.class)}>
      {props.children ?? <Icon icon={GalleryThumbnails} data-slot="lightbox-thumbnails-icon" />}
    </LightboxThumbnailsTogglePrimitive>
  ) as JSX.Element;

/* -------------------------------------------------------------------------------------------------
 * Counter, captions, thumbnails
 * -----------------------------------------------------------------------------------------------*/
const LightboxCounter = (props: LightboxCounterProps): JSX.Element =>
  (<LightboxCounterPrimitive {...props} class={join(lightboxSlots().counter(), props.class)} />) as JSX.Element;

type LightboxCaptionsProps = LightboxCaptionsPrimitiveProps;

const LightboxCaptions = (props: LightboxCaptionsProps): JSX.Element => {
  const slots = lightboxSlots();
  return (
    <LightboxCaptionsPrimitive
      {...props}
      class={join(slots.captions(), props.class)}
      titleClass={join(slots.captionsTitle(), props.titleClass)}
      descriptionClass={join(slots.captionsDescription(), props.descriptionClass)}
    />
  ) as JSX.Element;
};

type LightboxThumbnailsProps = LightboxThumbnailsPrimitiveProps;

/** Thumbnails strip; slides without an image show a type icon unless `children` renders them. */
const LightboxThumbnails = (props: LightboxThumbnailsProps): JSX.Element => {
  const slots = lightboxSlots();
  const icon = slots.thumbnailIcon();
  const render = props.children;
  return (
    <LightboxThumbnailsPrimitive
      {...props}
      class={join(slots.thumbnails(), props.class)}
      thumbnailClass={join(slots.thumbnail(), props.thumbnailClass)}
      children={
        render ??
        ((slide) => (
          <Icon
            icon={slide.type === "video" ? Film : slide.type === "embed" ? Play : slide.type === "pdf" ? FileText : ImageIcon}
            class={icon}
            data-slot="lightbox-thumbnail-icon"
          />
        ))
      }
    />
  ) as JSX.Element;
};

/* -------------------------------------------------------------------------------------------------
 * Inline
 * -----------------------------------------------------------------------------------------------*/
type LightboxInlineProps = LightboxInlinePrimitiveProps;

/** Default inline parts (no children): slides, Previous / Next. */
function LightboxInlineDefaultParts() {
  return (
    <>
      <LightboxSlides />
      <LightboxPrevious />
      <LightboxNext />
    </>
  );
}

/** An in-page lightbox (cdk `LightboxInline`): size it with `class` / `style`. */
const LightboxInline = (props: LightboxInlineProps): JSX.Element => {
  const slots = lightboxSlots();
  const children = props.children;
  return (
    <LightboxInlinePrimitive
      {...props}
      class={join(slots.inline(), props.class)}
      containerClass={join(slots.container(), props.containerClass)}
      children={children ?? (() => <LightboxInlineDefaultParts />)}
    />
  ) as JSX.Element;
};

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
};
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
};
