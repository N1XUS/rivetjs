// Ported from yet-another-react-lightbox (src/plugins/thumbnails/{Thumbnails.tsx,ThumbnailsTrack.tsx,Thumbnail.tsx,
// ThumbnailsButton.tsx,ThumbnailsContext.tsx,props.ts}, v3.32.2), MIT, © Igor Danchenko.
// Rivet:
// - `<LightboxThumbnails>` strip part: every slide is a thumbnail button (YARL renders the carousel window + fading
//   placeholders and animates the track); the strip scrolls natively and the core keeps the current one in view
//   (`scrollIntoView` nearest after each slide change). Grid area of the container = `position` (YARL shrinks the
//   carousel by the strip size).
// - Thumbnail image: `slide.thumbnail` || the smallest `srcSet` entry || image `src` || video / embed `poster`; other
//   slides render the `children(slide)` render function (YARL `render.thumbnail`; the styled layer passes lucide icons
//   per type).
// - Visibility = `state.thumbnails` (resumable; YARL ThumbnailsContext `visible`), toggled by
//   `<LightboxThumbnailsToggle>`; both parts take `hidden`.
// - Thumbnails are `aria-hidden`-free buttons labelled "Go to slide k" (Rivet: YARL thumbnails are unlabelled buttons).
import { For, Show } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import type { StyleObject } from "@rivetjs/runtime/style";
import { lightboxGoTo } from "../behaviour.ts";
import { LightboxButton, lightboxToggleContent, useLightbox, type LightboxToggleChildren } from "../index.tsx";
import { isImageSlide, lightboxIndex, lightboxSlides, translateLabel, type LightboxImageFit, type LightboxSlide, type LightboxState } from "../state.ts";
import { dataBool } from "../../utils/data-attrs.tsx";

/** Thumbnails plugin options (YARL `ThumbnailsProps`). */
export interface LightboxThumbnailsOptions {
  /** @default "bottom" */
  position?: "top" | "bottom" | "start" | "end";
  /** Thumbnail width / height (px). @default 120 × 80 */
  width?: number;
  height?: number;
  /** Border width (px). @default 1 */
  border?: number;
  /** @default 4 */
  borderRadius?: number;
  /** Inner padding (px). @default 4 */
  padding?: number;
  /** Gap between thumbnails (px; also the strip padding). @default 16 */
  gap?: number;
  /** @default "contain" */
  imageFit?: LightboxImageFit;
  /** Fade the strip edges. @default true */
  vignette?: boolean;
  /** Initially hidden. @default false */
  hidden?: boolean;
}

/** The thumbnail image URL of a slide (YARL `Thumbnail` `renderThumbnail`). */
export function lightboxThumbnailSrc(slide: LightboxSlide): string | undefined {
  if (slide.thumbnail) return slide.thumbnail;
  if (isImageSlide(slide)) {
    const smallest = slide.srcSet?.slice().sort((a, b) => a.width - b.width)[0];
    return smallest?.src ?? slide.src;
  }
  const poster = (slide as { poster?: unknown }).poster;
  return typeof poster === "string" ? poster : undefined;
}

/** Whether thumbnails are visible (tracked). */
export const lightboxThumbnailsVisible = (state: LightboxState, hidden = false): boolean => state.thumbnails() ?? !hidden;

/** Shows / hides the thumbnails (YARL `thumbnails.ref` `show` / `hide`). */
export function setLightboxThumbnails(state: LightboxState, visible: boolean): void {
  state.thumbnails.set(visible);
}

export interface LightboxThumbnailsProps extends LightboxThumbnailsOptions {
  /** Class of the strip. @default "rv-LightboxThumbnails" */
  class?: string;
  style?: StyleObject;
  /** Class of each thumbnail button. @default "rv-LightboxThumbnail" */
  thumbnailClass?: string;
  /** Content of thumbnails without an image (YARL `render.thumbnail`), by slide. */
  children?: (slide: LightboxSlide) => Content;
}

/** The thumbnails strip (YARL `ThumbnailsTrack`). */
export function LightboxThumbnails(props: LightboxThumbnailsProps) {
  const state = useLightbox();
  const position = props.position ?? "bottom",
    width = props.width ?? 120,
    height = props.height ?? 80,
    border = props.border ?? 1,
    radius = props.borderRadius ?? 4,
    padding = props.padding ?? 4,
    gap = props.gap ?? 16,
    fit = props.imageFit ?? "contain",
    vignette = props.vignette ?? true,
    hidden = props.hidden ?? false;
  const cls = props.class ?? "rv-LightboxThumbnails",
    style = props.style,
    thumbCls = props.thumbnailClass ?? "rv-LightboxThumbnail",
    render = props.children;
  const vertical = position === "start" || position === "end";
  const labels = state.labels;
  const items = () => lightboxSlides(state).map((slide, index) => ({ slide, index }));
  const fade = `${gap}px`;
  const mask = vignette ? `linear-gradient(to ${vertical ? "bottom" : "right"}, transparent, #000 ${fade}, #000 calc(100% - ${fade}), transparent)` : undefined;
  return (
    <Show when={() => lightboxThumbnailsVisible(state, hidden)}>
      {() => (
        <div
          class={cls}
          data-lightbox-thumbnails=""
          data-position={position}
          style={
            {
              gridArea: position,
              position: "relative",
              display: "flex",
              flexDirection: vertical ? "column" : "row",
              gap: `${gap}px`,
              padding: `${gap}px`,
              overflow: "auto",
              overscrollBehavior: "contain",
              scrollbarWidth: "none",
              maskImage: mask,
              WebkitMaskImage: mask,
              ...style,
            } as never
          }
        >
          <For each={items} by={(item) => item.index}>
            {(item) => (
              <button
                type="button"
                class={thumbCls}
                data-lightbox-thumbnail=""
                data-index={item().index}
                data-type={item().slide.type ?? "image"}
                data-current={dataBool(lightboxIndex(state) === item().index)}
                aria-current={lightboxIndex(state) === item().index ? "true" : undefined}
                aria-label={translateLabel(labels, "Go to slide {index}").replace("{index}", String(item().index + 1))}
                style={
                  {
                    flex: "none",
                    boxSizing: "border-box",
                    width: `${width + 2 * (border + padding)}px`,
                    height: `${height + 2 * (border + padding)}px`,
                    padding: `${padding}px`,
                    borderWidth: `${border}px`,
                    borderStyle: border ? "solid" : "none",
                    borderRadius: `${radius}px`,
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  } as never
                }
                onClick={() => lightboxGoTo(state, item().index)}
              >
                {lightboxThumbnailSrc(item().slide) ? (
                  <img
                    src={lightboxThumbnailSrc(item().slide)}
                    alt=""
                    loading="lazy"
                    draggable={false}
                    style={
                      {
                        width: "100%",
                        height: "100%",
                        objectFit: fit,
                        borderRadius: `${Math.max(radius - padding - border, 0)}px`,
                        pointerEvents: "none",
                      } as never
                    }
                  />
                ) : render ? (
                  render(item().slide)
                ) : null}
              </button>
            )}
          </For>
        </div>
      )}
    </Show>
  );
}

export interface LightboxThumbnailsToggleProps {
  class?: string;
  style?: StyleObject;
  /** Initially hidden (same value as the `LightboxThumbnails` part). @default false */
  hidden?: boolean;
  /** Label override (default "Show thumbnails" / "Hide thumbnails"). */
  label?: string;
  children?: LightboxToggleChildren;
}

/** Show / hide thumbnails button (YARL `ThumbnailsButton`). */
export function LightboxThumbnailsToggle(props: LightboxThumbnailsToggleProps) {
  const state = useLightbox();
  const hidden = props.hidden ?? false,
    label = props.label,
    children = props.children;
  const visible = () => lightboxThumbnailsVisible(state, hidden);
  return (
    <LightboxButton
      class={props.class}
      style={props.style}
      action="thumbnails"
      pressed={visible}
      label={() => label ?? translateLabel(state.labels, visible() ? "Hide thumbnails" : "Show thumbnails")}
      onPress={() => setLightboxThumbnails(state, !lightboxThumbnailsVisible(state, hidden))}
    >
      {lightboxToggleContent(children, visible)}
    </LightboxButton>
  );
}
