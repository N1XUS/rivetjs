// Rivet-authored (NOT a HeroUI port: HeroUI v3.2.6 has no lightbox): styled parts over `@rivetjs/cdk/lightbox`
// (yet-another-react-lightbox 3.32.2 port, MIT, © Igor Danchenko); styles Rivet-authored in `styles/`.
// Rivet:
// - Core parts here (compound `Lightbox.*`): `Lightbox` (modal root: backdrop `opaque` / `blur`, default parts when no
//   children), `.Slides` (carousel; default slide = `LightboxMedia`), `.Media` (image / video / embed / PDF switch),
//   `.Image`, `.Toolbar`, `.Close` / `.Previous` / `.Next` (HeroUI icon-only Button classes + lucide icons), `.Button`.
//   Plugin parts (`./plugins.tsx`) are named exports only (not compound statics), so an unused plugin tree-shakes.
// - Classes are plain strings (tv slots memo); no live style props (the composed class is a local: it reaches the cdk parts as a plain value).
// - Default render functions go through the `children` attribute, never a `{fn}` JSX child (that is a slot accessor: the cdk
//   would render the function's slot, not call it with the slide).
import { Icon } from "@rivetjs/kit/icon";
import {
  Lightbox as LightboxPrimitive,
  LightboxButton as LightboxButtonPrimitive,
  LightboxCarousel as LightboxCarouselPrimitive,
  LightboxClose as LightboxClosePrimitive,
  LightboxImage as LightboxImagePrimitive,
  LightboxNext as LightboxNextPrimitive,
  LightboxPrevious as LightboxPreviousPrimitive,
  LightboxToolbar as LightboxToolbarPrimitive,
  useLightboxSlide,
} from "@rivetjs/cdk/lightbox";
import type {
  LightboxButtonProps as LightboxButtonPrimitiveProps,
  LightboxCarouselProps as LightboxCarouselPrimitiveProps,
  LightboxImageProps as LightboxImagePrimitiveProps,
  LightboxProps as LightboxPrimitiveProps,
  LightboxToolbarProps as LightboxToolbarPrimitiveProps,
} from "@rivetjs/cdk/lightbox";
import { LightboxEmbed as LightboxEmbedPrimitive } from "@rivetjs/cdk/lightbox/embed";
import { LightboxPdf as LightboxPdfPrimitive } from "@rivetjs/cdk/lightbox/pdf";
import { LightboxVideo as LightboxVideoPrimitive } from "@rivetjs/cdk/lightbox/video";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import { ChevronLeft, ChevronRight, FileText, ImageOff, LoaderCircle, X } from "lucide";

import { buttonVariants } from "../../../styles/src/components/button/index.ts";
import type { LightboxVariants } from "../../../styles/src/components/lightbox/index.ts";
import { lightboxVariants } from "../../../styles/src/components/lightbox/index.ts";
import { portalTheme } from "../../utils/portal-theme.ts";

type LightboxSlots = ReturnType<typeof lightboxVariants>;
const SLOTS: Record<string, LightboxSlots> = {};
/** tv slots per backdrop variant (module memo). */
export const lightboxSlots = (backdrop: LightboxVariants["backdrop"] = "opaque"): LightboxSlots =>
  (SLOTS[backdrop ?? "opaque"] ??= lightboxVariants({ backdrop }));

const join = (...parts: (string | undefined)[]): string => parts.filter(Boolean).join(" ");
/** Classes of a lightbox icon button (HeroUI icon-only Button + `lightbox__button`). */
export const lightboxButtonClass = (extra?: string, cls?: string): string =>
  join(buttonVariants({ isIconOnly: true, size: "md", variant: "tertiary" }), lightboxSlots().button(), extra, cls);

/* -------------------------------------------------------------------------------------------------
 * Lightbox Root
 * -----------------------------------------------------------------------------------------------*/
interface LightboxRootProps extends Omit<LightboxPrimitiveProps, "overlayClass" | "containerClass"> {
  /** Backdrop look. @default "opaque" */
  backdrop?: LightboxVariants["backdrop"];
  /** Extra backdrop class. */
  backdropClass?: string;
  /** Extra container class (gesture surface, `role="dialog"`). */
  containerClass?: string;
}

/** Default parts (no children): slides with every media type, Close, Previous / Next. */
function LightboxDefaultParts() {
  return (
    <>
      <LightboxSlides />
      <LightboxToolbar>
        <LightboxClose />
      </LightboxToolbar>
      <LightboxPrevious />
      <LightboxNext />
    </>
  );
}

const LightboxRoot = (props: LightboxRootProps): JSX.Element => {
  portalTheme();
  const slots = lightboxSlots(props.backdrop);
  const children = props.children;
  return (
    <LightboxPrimitive
      {...props}
      class={join(slots.base(), props.class)}
      overlayClass={join(slots.backdrop(), props.backdropClass)}
      containerClass={join(slots.container(), props.containerClass)}
      children={children ?? (() => <LightboxDefaultParts />)}
    />
  ) as JSX.Element;
};

/* -------------------------------------------------------------------------------------------------
 * Slides + media
 * -----------------------------------------------------------------------------------------------*/
type LightboxSlidesProps = LightboxCarouselPrimitiveProps;

/** The carousel (cdk `LightboxCarousel`); default slide content = `LightboxMedia`. */
const LightboxSlides = (props: LightboxSlidesProps): JSX.Element => {
  const slots = lightboxSlots();
  const render = props.children;
  return (
    <LightboxCarouselPrimitive
      {...props}
      class={join(slots.carousel(), props.class)}
      slideClass={join(slots.slide(), props.slideClass)}
      children={render ?? (() => <LightboxMedia />)}
    />
  ) as JSX.Element;
};

type LightboxImageProps = LightboxImagePrimitiveProps;

/** An image slide with a spinner while loading and an icon on error. */
const LightboxImage = (props: LightboxImageProps): JSX.Element => {
  const slots = lightboxSlots();
  return (
    <LightboxImagePrimitive
      {...props}
      class={join(slots.image(), props.class)}
      placeholderClass={join(slots.placeholder(), props.placeholderClass)}
      loading={props.loading ?? <Icon icon={LoaderCircle} data-slot="lightbox-loading-icon" />}
      error={props.error ?? <Icon icon={ImageOff} data-slot="lightbox-error-icon" />}
    />
  ) as JSX.Element;
};

interface LightboxMediaProps {
  /** Content for custom slide types (`type` not image / video / embed / pdf). */
  fallback?: Content;
}

/** The current carousel slide by type: image, video, embed (iframe only while current), PDF (native viewer). */
const LightboxMedia = (props: LightboxMediaProps): JSX.Element => {
  const ctx = useLightboxSlide();
  const slots = lightboxSlots();
  const type = ctx?.slide.type ?? "image";
  const fallback = props.fallback;
  if (type === "image") return (<LightboxImage />) as JSX.Element;
  if (type === "video") return (<LightboxVideoPrimitive class={slots.video()} />) as JSX.Element;
  if (type === "embed") return (<LightboxEmbedPrimitive class={slots.embed()} posterClass={slots.embedPoster()} />) as JSX.Element;
  if (type === "pdf")
    return (
      <LightboxPdfPrimitive
        class={slots.pdf()}
        fallbackClass={slots.pdfFallback()}
        fallback={
          <>
            <Icon icon={FileText} data-slot="lightbox-pdf-icon" />
            <span>{(ctx?.slide as { title?: string }).title ?? "Open PDF"}</span>
          </>
        }
      />
    ) as JSX.Element;
  return (fallback ?? null) as JSX.Element;
};

/* -------------------------------------------------------------------------------------------------
 * Toolbar + buttons
 * -----------------------------------------------------------------------------------------------*/
type LightboxToolbarProps = LightboxToolbarPrimitiveProps;

const LightboxToolbar = (props: LightboxToolbarProps): JSX.Element =>
  (<LightboxToolbarPrimitive {...props} class={join(lightboxSlots().toolbar(), props.class)} />) as JSX.Element;

type LightboxButtonProps = LightboxButtonPrimitiveProps;

/** A custom toolbar button with the lightbox look (cdk `LightboxButton`). */
const LightboxButton = (props: LightboxButtonProps): JSX.Element =>
  (<LightboxButtonPrimitive {...props} class={lightboxButtonClass(undefined, props.class)} />) as JSX.Element;

const LightboxClose = (props: LightboxButtonProps): JSX.Element =>
  (
    <LightboxClosePrimitive {...props} class={lightboxButtonClass(undefined, props.class)}>
      {props.children ?? <Icon icon={X} data-slot="lightbox-close-icon" />}
    </LightboxClosePrimitive>
  ) as JSX.Element;

const LightboxPrevious = (props: LightboxButtonProps): JSX.Element =>
  (
    <LightboxPreviousPrimitive {...props} class={lightboxButtonClass(lightboxSlots().previous(), props.class)}>
      {props.children ?? <Icon icon={ChevronLeft} data-slot="lightbox-previous-icon" />}
    </LightboxPreviousPrimitive>
  ) as JSX.Element;

const LightboxNext = (props: LightboxButtonProps): JSX.Element =>
  (
    <LightboxNextPrimitive {...props} class={lightboxButtonClass(lightboxSlots().next(), props.class)}>
      {props.children ?? <Icon icon={ChevronRight} data-slot="lightbox-next-icon" />}
    </LightboxNextPrimitive>
  ) as JSX.Element;

export { LightboxButton, LightboxClose, LightboxImage, LightboxMedia, LightboxNext, LightboxPrevious, LightboxRoot, LightboxSlides, LightboxToolbar };
export type { LightboxButtonProps, LightboxImageProps, LightboxMediaProps, LightboxRootProps, LightboxSlidesProps, LightboxToolbarProps };
