// Ported from yet-another-react-lightbox (src/Lightbox.tsx, src/modules/{Portal,Controller/Controller,Carousel,Toolbar,
// Navigation/Navigation}.tsx, src/components/{ImageSlide,IconButton}.tsx, v3.32.2), MIT, © Igor Danchenko.
// Rivet:
// - Parts instead of YARL's module tree + plugin augmentation: `<Lightbox>` (portal root on the cdk div overlay layer:
//   `ModalOverlay` > `Modal role="dialog"`, never a native `<dialog>`) wraps a render-function child with the parts:
//   `LightboxCarousel` (slides; children = YARL `render.slide`), `LightboxToolbar`, `LightboxClose`, `LightboxPrevious`,
//   `LightboxNext`; plugins are parts in their own subpaths (`@rivetjs/cdk/lightbox/zoom`, …): 0 B unless imported.
// - Focus containment / restoration, Escape (`controller.closeOnEscape`), scroll lock and `inert` outside = cdk
//   `ModalOverlay` (YARL Portal + NoScroll). Fade = CSS on `[data-entering]` / `[data-exiting]` (duration
//   `--rv-lightbox-fade`, written only for an explicit `animation.fade`); `onEntering` / `onEntered` / `onExiting` / `onExited` follow the overlay's enter / exit.
// - Layout: the container is a CSS grid (`top` / `start` / `main` / `end` / `bottom` areas): the carousel fills `main`,
//   the Thumbnails strip takes its side's area (YARL shrinks the carousel by the thumbnails size); toolbar, navigation and
//   captions are absolutely positioned (not grid items).
// - Slides render as absolutely positioned boxes at `inset-inline-start: offset × (100% + spacing)` (RTL mirrors), the
//   track moves with the house motion (`./behaviour.ts`); 2 × preload + 1 slides in the DOM, keyed by global position.
// - Media sizing is CSS only (no measurement): slides are size containers, media fit with `max-width` / `max-height`
//   (images) or `cqw` / `cqh` boxes (video, embed, PDF); image `sizes` = `min(100vw, <ratio>vh)` unless given.
// - Icons: headless — buttons render their children (the styled layer passes lucide icons); YARL's SVG icons dropped.
// - Resumable: a closed lightbox renders only the overlay anchor; slides data must serialize (plain objects). Inline
//   (`./inline`) server-renders the view; its browser-only listeners install on the first pointer / focus.
import { computed, createContext, onCleanup, signal, untrack, useContext } from "@rivetjs/reactivity";
import { For, Provider, Show, clientEffect } from "@rivetjs/runtime/dom";
import type { Content, JSX } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { isSlot, renderSlot } from "@rivetjs/runtime/slot";
import { Modal, ModalOverlay } from "../modal/index.tsx";
import { OverlayTriggerStateContext } from "../overlay/contexts.ts";
import { createOverlayTriggerState, type OverlayTriggerProps } from "../state/overlays.ts";
import { dataBool } from "../utils/data-attrs.tsx";
import { useId } from "../utils/id.ts";
import {
  closeLightbox,
  ensureLightbox,
  focusLightbox,
  lightboxKeyDown,
  lightboxLengthCss,
  lightboxNext,
  lightboxPointerDown,
  lightboxPointerMove,
  lightboxPointerUp,
  lightboxPrev,
  syncLightboxIndex,
  syncLightboxMedia,
} from "./behaviour.ts";
import {
  createLightboxState,
  getSlideIndex,
  isImageFitCover,
  isImageSlide,
  lightboxIndex,
  lightboxNavigation,
  lightboxSlides,
  lightboxWindow,
  translateLabel,
  translateSlideCounter,
  type LightboxLabel,
  type LightboxSlide,
  type LightboxSlideImage,
  type LightboxState,
  type LightboxStateProps,
} from "./state.ts";
import { liveOptions } from "../utils/live.tsx";

export * from "./state.ts";
export * from "./behaviour.ts";

/* ------------------------------------------------------------------------------------------------
 * Contexts
 * ----------------------------------------------------------------------------------------------*/

/** The lightbox state for the parts. */
export const LightboxContext = createContext<LightboxState | null>(null);

/** One rendered slide: the slide, its index and its global position (offset = position − globalIndex). */
export interface LightboxSlideContextValue {
  slide: LightboxSlide;
  index: number;
  position: number;
}
export const LightboxSlideContext = createContext<LightboxSlideContextValue | null>(null);

/** The enclosing lightbox state (throws outside a lightbox). */
export function useLightbox(): LightboxState {
  const state = useContext(LightboxContext);
  if (!state) throw new Error("Lightbox parts must be rendered inside <Lightbox> or <LightboxInline>.");
  return state;
}

/** The enclosing slide (`null` outside a carousel slide). */
export const useLightboxSlide = (): LightboxSlideContextValue | null => useContext(LightboxSlideContext);

/** Offset of a rendered slide from the current one (tracked; 0 = current). */
export const lightboxSlideOffset = (state: LightboxState, slide: LightboxSlideContextValue): number => slide.position - state.globalIndex();

/* ------------------------------------------------------------------------------------------------
 * Lightbox (root)
 * ----------------------------------------------------------------------------------------------*/

export interface LightboxProps extends LightboxStateProps, OverlayTriggerProps {
  id?: string;
  /** Class of the dialog element. @default "rv-Lightbox" */
  class?: string;
  style?: StyleObject;
  /** Class of the backdrop / overlay element. @default "rv-LightboxOverlay" */
  overlayClass?: string;
  overlayStyle?: StyleObject;
  /** Class of the container (gesture surface, `role="dialog"`). @default "rv-LightboxContainer" */
  containerClass?: string;
  /** Accessible name of the dialog. @default labels.Lightbox */
  "aria-label"?: string;
  /** Parts (a render function: the content is created when the lightbox opens). Default: carousel, close, prev / next. */
  children?: Content | (() => Content);
}

/**
 * A modal media lightbox (YARL `<Lightbox>`): portal on the cdk overlay layer, focus trap + restore, Escape, scroll lock,
 * swipe / pull / wheel / keyboard navigation.
 */
export function Lightbox(props: LightboxProps) {
  const id = useId(props.id);
  // Live props: a controlled `isOpen={open()}` stays live (accessor; `controllable` reads it, never writes it).
  const overlay = createOverlayTriggerState({
    isOpen: liveOptions(props, [], ["isOpen"]).isOpen,
    defaultOpen: props.defaultOpen,
    onOpenChange: props.onOpenChange,
  });
  const state = createLightboxState(props, id, overlay);
  const children = props.children;
  const cls = props.class ?? "rv-Lightbox",
    style = props.style,
    overlayCls = props.overlayClass ?? "rv-LightboxOverlay",
    overlayStyle = props.overlayStyle,
    containerCls = props.containerClass;
  const label = props["aria-label"] ?? translateLabel(state.labels, "Lightbox");
  // `--rv-lightbox-fade` only when `animation.fade` is given: unset, the stylesheet's own timing applies (ui: overlay tokens).
  const fade = props.animation?.fade;
  const on = state.on;
  return (
    <Provider token={OverlayTriggerStateContext} value={overlay}>
      <ModalOverlay
        isKeyboardDismissDisabled={!state.controller.closeOnEscape}
        class={overlayCls}
        style={(fade == null ? overlayStyle : { "--rv-lightbox-fade": `${fade}ms`, ...overlayStyle }) as never}
        data-lightbox-overlay=""
        onEnter={() => on.onEntering?.()}
        onExit={() => on.onExiting?.()}
      >
        {(values: { isEntering: () => boolean }) => (
          <Modal class={cls} style={{ position: "absolute", inset: "0", ...style } as never} data-lightbox-root="">
            {() => (
              <LightboxView state={state} entering={values.isEntering} dialogLabel={label} class={containerCls}>
                {children}
              </LightboxView>
            )}
          </Modal>
        )}
      </ModalOverlay>
    </Provider>
  );
}

/* ------------------------------------------------------------------------------------------------
 * LightboxView (YARL Controller container; shared by Lightbox and LightboxInline)
 * ----------------------------------------------------------------------------------------------*/

export interface LightboxViewProps {
  state: LightboxState;
  /** Overlay entering accessor (modal only): `onEntered` fires when it turns false. */
  entering?: () => boolean;
  /** Modal: the container is the `role="dialog"` element with this accessible name. */
  dialogLabel?: string;
  /** @default "rv-LightboxContainer" */
  class?: string;
  style?: StyleObject;
  children?: Content | (() => Content);
}

/** Default parts when a lightbox has no children (YARL default modules: carousel, toolbar with Close, navigation). */
function DefaultParts(props: { inline: boolean }) {
  const inline = props.inline;
  return (
    <>
      <LightboxCarousel />
      {inline ? null : (
        <LightboxToolbar>
          <LightboxClose />
        </LightboxToolbar>
      )}
      <LightboxPrevious />
      <LightboxNext />
    </>
  );
}

/** The interactive container: pointer swipe / pull, keyboard, wheel (YARL `Controller`). */
export function LightboxView(props: LightboxViewProps) {
  const state = props.state;
  const children = props.children;
  const cls = props.class ?? "rv-LightboxContainer",
    style = props.style,
    dialogLabel = props.dialogLabel;
  // Opening with a changed `index`: start there (no animation).
  untrack(() => syncLightboxIndex(state));
  if (!state.inline) {
    const on = state.on,
      entering = props.entering;
    clientEffect(() =>
      untrack(() => {
        ensureLightbox(state);
        if (state.controller.focus) focusLightbox(state);
        on.onView?.({ index: lightboxIndex(state) });
        queueMicrotask(() => syncLightboxMedia(state));
      }),
    );
    // Controlled `index` changed from outside while open: jump.
    clientEffect(() => syncLightboxIndex(state));
    let entered = false;
    clientEffect(() => {
      if (entered || (entering && entering())) return;
      entered = true;
      untrack(() => on.onEntered?.());
    });
    onCleanup(() => {
      if (typeof document !== "undefined") on.onExited?.();
    });
  }
  return (
    <div
      id={`${state.id}-container`}
      class={cls}
      tabIndex={-1}
      role={dialogLabel === undefined ? undefined : "dialog"}
      aria-modal={dialogLabel === undefined ? undefined : "true"}
      aria-label={dialogLabel}
      data-lightbox-container=""
      data-inline={dataBool(state.inline)}
      data-gesture={state.gesture()}
      style={
        {
          position: "absolute",
          inset: "0",
          overflow: "hidden",
          display: "grid",
          gridTemplate: `"top top top" auto "start main end" minmax(0, 1fr) "bottom bottom bottom" auto / auto minmax(0, 1fr) auto`,
          touchAction: state.controller.touchAction,
          ...style,
        } as never
      }
      onPointerDown={(event) => lightboxPointerDown(state, event)}
      onPointerMove={(event) => lightboxPointerMove(state, event)}
      onPointerUp={(event) => lightboxPointerUp(state, event)}
      onPointerCancel={(event) => lightboxPointerUp(state, event)}
      onPointerEnter={() => ensureLightbox(state)}
      onFocusIn={() => ensureLightbox(state)}
      onKeyDown={(event) => lightboxKeyDown(state, event)}
    >
      <Provider token={LightboxContext} value={state}>
        {children === undefined ? <DefaultParts inline={state.inline} /> : renderSlot(children)}
      </Provider>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * LightboxCarousel (YARL Carousel)
 * ----------------------------------------------------------------------------------------------*/

/** What a slide render function gets besides the slide. */
export interface LightboxRenderSlideInfo {
  /** Slide index in `[0, n)`. */
  index: number;
  /** Offset from the current slide (tracked accessor; 0 = current). */
  offset: () => number;
}

export interface LightboxCarouselProps {
  /** @default "rv-LightboxCarousel" */
  class?: string;
  style?: StyleObject;
  /** Class of every slide box. @default "rv-LightboxSlide" */
  slideClass?: string;
  slideStyle?: StyleObject;
  /** Renders a slide (YARL `render.slide`); default: `<LightboxImage />` for image slides, nothing for other types. */
  children?: (slide: LightboxSlide, info: LightboxRenderSlideInfo) => Content;
}

/** The slides around the current one (2 × preload + 1), APG carousel semantics (YARL `Carousel`). */
export function LightboxCarousel(props: LightboxCarouselProps) {
  const state = useLightbox();
  const render = props.children;
  const renderFn = typeof render === "function" && !isSlot(render) ? render : undefined;
  const cls = props.class ?? "rv-LightboxCarousel",
    style = props.style,
    slideCls = props.slideClass ?? "rv-LightboxSlide",
    slideStyle = props.slideStyle;
  const labels = state.labels;
  const items = computed(() => lightboxWindow(state));
  const spacing = lightboxLengthCss(state.carousel.spacing);
  const padding = lightboxLengthCss(state.carousel.padding);
  return (
    <div
      id={`${state.id}-carousel`}
      class={cls}
      role="region"
      aria-roledescription={translateLabel(labels, "Carousel")}
      aria-label={translateLabel(labels, "Photo gallery")}
      aria-live={state.playing() ? "off" : "polite"}
      data-lightbox-carousel=""
      style={{ position: "relative", gridArea: "main", minWidth: "0", minHeight: "0", ...style } as never}
    >
      <For each={items} by={(item) => item.key}>
        {(item) => (
          <LightboxSlideBox
            state={state}
            slide={untrack(item).slide}
            index={untrack(item).index}
            position={untrack(item).offset + untrack(state.globalIndex)}
            class={slideCls}
            style={slideStyle}
            spacing={spacing}
            padding={padding}
            render={renderFn}
          />
        )}
      </For>
    </div>
  );
}

function LightboxSlideBox(props: {
  state: LightboxState;
  slide: LightboxSlide;
  index: number;
  position: number;
  class: string;
  style: StyleObject | undefined;
  spacing: string;
  padding: string;
  render: ((slide: LightboxSlide, info: LightboxRenderSlideInfo) => Content) | undefined;
}) {
  const { state, slide, index, position, spacing, padding, render } = props;
  const cls = props.class,
    style = props.style;
  const labels = state.labels;
  const value: LightboxSlideContextValue = { slide, index, position };
  const info: LightboxRenderSlideInfo = { index, offset: () => position - state.globalIndex() };
  return (
    <div
      class={cls}
      role="group"
      aria-roledescription={translateLabel(labels, "Slide")}
      aria-label={translateSlideCounter(labels, lightboxSlides(state).length, index)}
      data-lightbox-slide=""
      data-index={index}
      data-type={slide.type ?? "image"}
      data-current={dataBool(position === state.globalIndex())}
      inert={position === state.globalIndex() ? undefined : (true as never)}
      style={
        {
          position: "absolute",
          top: "0",
          bottom: "0",
          width: "100%",
          insetInlineStart: `calc(${position - state.globalIndex()} * (100% + ${spacing}))`,
          boxSizing: "border-box",
          padding,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          containerType: "size",
          ...style,
        } as never
      }
    >
      <Provider token={LightboxSlideContext} value={value}>
        {render ? render(slide, info) : isImageSlide(slide) ? <LightboxImage /> : null}
      </Provider>
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * LightboxImage (YARL ImageSlide)
 * ----------------------------------------------------------------------------------------------*/

export interface LightboxImageProps {
  /** The image slide (default: the enclosing carousel slide). */
  slide?: LightboxSlideImage;
  /** @default "rv-LightboxImage" */
  class?: string;
  style?: StyleObject;
  /** Extra `<img>` attributes (YARL `carousel.imageProps`). */
  imageProps?: JSX.IntrinsicElements["img"];
  /** Content shown while loading (YARL `render.iconLoading`). */
  loading?: Content;
  /** Content shown when the image failed (YARL `render.iconError`). */
  error?: Content;
  /** Class of the loading / error placeholder. @default "rv-LightboxPlaceholder" */
  placeholderClass?: string;
}

const maxOf = (values: number[]): number => {
  const max = Math.max(...values.filter(Boolean));
  return Number.isFinite(max) ? max : 0;
};

/** An image slide: `srcset` / `sizes`, `object-fit`, loading / error placeholder, `onClick` (YARL `ImageSlide`). */
export function LightboxImage(props: LightboxImageProps) {
  const state = useLightbox();
  const ctx = useLightboxSlide();
  const image = (props.slide ?? ctx?.slide) as LightboxSlideImage;
  const position = ctx?.position;
  const index = ctx?.index ?? 0;
  const cls = props.class ?? "rv-LightboxImage",
    style = props.style,
    imageProps = props.imageProps,
    loading = props.loading,
    error = props.error,
    placeholderCls = props.placeholderClass ?? "rv-LightboxPlaceholder";
  // Server-rendered images (inline) may load before the page resumes: assume complete and bind no load / error
  // handlers (a cold `load` would boot the page and replay per image); browser-created ones track their status.
  const browser = typeof document !== "undefined";
  const status = signal<"loading" | "complete" | "error">(browser ? "loading" : "complete");
  const cover = isImageFitCover(image, state.carousel.imageFit);
  const maxWidth = maxOf([...(image.srcSet?.map((x) => x.width) ?? []), image.width ?? 0]);
  const maxHeight = maxOf([...(image.srcSet?.map((x) => x.height) ?? []), image.height ?? 0]);
  const srcSet = image.srcSet
    ?.slice()
    .sort((a, b) => a.width - b.width)
    .map((item) => `${item.src} ${item.width}w`)
    .join(", ");
  const sizes =
    image.sizes ?? (srcSet ? (maxWidth && maxHeight && !cover ? `min(100vw, ${Math.round((maxWidth / maxHeight) * 1000) / 10}vh)` : "100vw") : undefined);
  const boxStyle = cover
    ? { width: "100%", height: "100%", objectFit: "cover" }
    : maxWidth && maxHeight
      ? { maxWidth: `min(${maxWidth}px, 100%)`, maxHeight: `min(${maxHeight}px, 100%)`, objectFit: "contain" }
      : { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" };
  const on = state.on;
  return (
    <>
      <img
        {...imageProps}
        class={cls}
        data-lightbox-zoomable=""
        data-cover={dataBool(cover)}
        data-status={status()}
        draggable={false}
        alt={image.alt ?? ""}
        width={image.width}
        height={image.height}
        sizes={sizes}
        srcSet={srcSet}
        src={image.src}
        style={{ ...boxStyle, minWidth: "0", minHeight: "0", userSelect: "none", ...style } as never}
        onLoad={
          browser
            ? (event: Event) => {
                const img = event.currentTarget as HTMLImageElement;
                ("decode" in img ? img.decode() : Promise.resolve())
                  .catch(() => {})
                  .then(() => {
                    if (img.isConnected) status.set("complete");
                  });
              }
            : undefined
        }
        onError={browser ? () => status.set("error") : undefined}
        onClick={() => {
          if (position === undefined || position === untrack(state.globalIndex)) on.onClick?.({ index });
        }}
      />
      <Show when={() => status() !== "complete" && (status() === "error" ? error !== undefined : loading !== undefined)}>
        {() => (
          <div
            class={placeholderCls}
            data-status={status()}
            aria-hidden="true"
            style={{ position: "absolute", inset: "0", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" } as never}
          >
            {status() === "error" ? renderSlot(error) : renderSlot(loading)}
          </div>
        )}
      </Show>
    </>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Toolbar + buttons (YARL Toolbar, Navigation, IconButton)
 * ----------------------------------------------------------------------------------------------*/

export interface LightboxToolbarProps {
  /** @default "rv-LightboxToolbar" */
  class?: string;
  style?: StyleObject;
  children?: Content;
}

/** Toolbar container (YARL `Toolbar`; position it with CSS). */
export function LightboxToolbar(props: LightboxToolbarProps) {
  const cls = props.class ?? "rv-LightboxToolbar",
    style = props.style,
    children = props.children;
  return (
    <div class={cls} style={style as never} data-lightbox-toolbar="">
      {renderSlot(children)}
    </div>
  );
}

export interface LightboxButtonProps {
  /** @default "rv-LightboxButton" */
  class?: string;
  style?: StyleObject;
  /** `aria-label` + `title` (default: the part's label). */
  label?: string;
  /** Icon / content. */
  children?: Content;
  /** Disabled (value or accessor). */
  isDisabled?: boolean | (() => boolean);
  onPress?: (event: MouseEvent) => void;
}

/** Content of a toggle button: plain content, or a function of the toggle's state accessor (`(on) => <Show when={on}>…`). */
export type LightboxToggleChildren = Content | ((on: () => boolean) => Content);

/** Renders toggle-button children (`LightboxToggleChildren`). */
export const lightboxToggleContent = (children: LightboxToggleChildren | undefined, on: () => boolean): Content =>
  typeof children === "function" && !isSlot(children) ? (children as (on: () => boolean) => Content)(on) : renderSlot(children as Content);

/** A labelled icon button (YARL `IconButton`): `type="button"`, `aria-label` + `title`, `data-action`; toggles set `pressed`. */
export function LightboxButton(
  props: Omit<LightboxButtonProps, "label"> & { label?: string | (() => string); action?: string; pressed?: () => boolean; hidden?: () => boolean },
) {
  const cls = props.class ?? "rv-LightboxButton",
    style = props.style,
    label = props.label,
    children = props.children,
    isDisabled = props.isDisabled,
    onPress = props.onPress,
    action = props.action,
    pressed = props.pressed,
    hidden = props.hidden;
  const disabled = () => (typeof isDisabled === "function" ? isDisabled() : !!isDisabled);
  const text = () => (typeof label === "function" ? label() : label);
  return (
    <button
      type="button"
      class={cls}
      style={style as never}
      aria-label={text()}
      title={text()}
      aria-pressed={pressed ? String(pressed()) : undefined}
      hidden={hidden ? hidden() : undefined}
      data-action={action}
      disabled={disabled()}
      data-disabled={dataBool(disabled())}
      onClick={(event) => onPress?.(event)}
    >
      {renderSlot(children)}
    </button>
  );
}

const labelOf = (state: LightboxState, label: string | undefined, key: LightboxLabel): string => label ?? translateLabel(state.labels, key);

/** Close button (YARL toolbar `close`). Hidden inline. */
export function LightboxClose(props: LightboxButtonProps) {
  const state = useLightbox();
  if (state.inline) return null;
  const onPress = props.onPress;
  return (
    <LightboxButton
      {...props}
      action="close"
      label={labelOf(state, props.label, "Close")}
      onPress={(event) => {
        closeLightbox(state);
        onPress?.(event);
      }}
    />
  );
}

/** Previous button (YARL Navigation); disabled at the start of a finite carousel. */
export function LightboxPrevious(props: LightboxButtonProps) {
  const state = useLightbox();
  const onPress = props.onPress;
  const isDisabled = props.isDisabled;
  return (
    <LightboxButton
      {...props}
      action="prev"
      label={labelOf(state, props.label, "Previous")}
      isDisabled={() => (typeof isDisabled === "function" ? isDisabled() : !!isDisabled) || lightboxNavigation(state).prevDisabled}
      onPress={(event) => {
        lightboxPrev(state);
        onPress?.(event);
      }}
    />
  );
}

/** Next button (YARL Navigation); disabled at the end of a finite carousel. */
export function LightboxNext(props: LightboxButtonProps) {
  const state = useLightbox();
  const onPress = props.onPress;
  const isDisabled = props.isDisabled;
  return (
    <LightboxButton
      {...props}
      action="next"
      label={labelOf(state, props.label, "Next")}
      isDisabled={() => (typeof isDisabled === "function" ? isDisabled() : !!isDisabled) || lightboxNavigation(state).nextDisabled}
      onPress={(event) => {
        lightboxNext(state);
        onPress?.(event);
      }}
    />
  );
}

/** Index of the current slide, for parts outside the carousel (tracked). */
export const useLightboxIndex = (): (() => number) => {
  const state = useLightbox();
  return () => getSlideIndex(state.globalIndex(), lightboxSlides(state).length);
};
