// Rivet-authored (no YARL counterpart): a PDF slide in the browser's built-in viewer.
// - `<object type="application/pdf">` (Chrome / Edge / Firefox / Safari desktop viewers) whose fallback content is a link
//   to the file (mobile browsers without an inline viewer, viewers disabled by policy). No pdf.js: 0 B of viewer code, the
//   native viewer brings search / print / zoom; pdf.js (~1 MB) would only buy custom chrome.
// - The `<object>` is mounted while the slide is current or a direct neighbour (preload, like images), so the
//   lightbox fetches nothing until opened; the carousel window drops it further away.
// - Sizing is CSS only (slide box = size container): page aspect ratio (A4 default) clamped to the slide box.
import { Show } from "@rivetjs/runtime/dom";
import type { Content } from "@rivetjs/runtime/jsx-runtime";
import { renderSlot } from "@rivetjs/runtime/slot";
import type { StyleObject } from "@rivetjs/runtime/style";
import { useLightbox, useLightboxSlide } from "../index.tsx";
import { translateLabel, type LightboxSlidePdf } from "../state.ts";

export interface LightboxPdfProps {
  /** The PDF slide (default: the enclosing carousel slide). */
  slide?: LightboxSlidePdf;
  /** @default "rv-LightboxPdf" */
  class?: string;
  style?: StyleObject;
  /** Class of the fallback link. @default "rv-LightboxPdfFallback" */
  fallbackClass?: string;
  /** Fallback content inside the link (default: the "Open PDF" label). */
  fallback?: Content;
  /** Fill the slide box instead of keeping the page aspect ratio. @default false */
  fill?: boolean;
}

/** A PDF slide: native viewer (`<object type="application/pdf">`) with a link fallback. */
export function LightboxPdf(props: LightboxPdfProps) {
  const state = useLightbox();
  const ctx = useLightboxSlide();
  const slide = (props.slide ?? ctx?.slide) as LightboxSlidePdf;
  const position = ctx?.position;
  const cls = props.class ?? "rv-LightboxPdf",
    style = props.style,
    fallbackCls = props.fallbackClass ?? "rv-LightboxPdfFallback",
    fallback = props.fallback;
  const width = slide.width ?? 1240,
    height = slide.height ?? 1754;
  const box = props.fill
    ? { width: "100%", height: "100%" }
    : { width: `min(100cqw, calc(100cqh * ${width} / ${height}))`, aspectRatio: `${width} / ${height}`, height: "auto" };
  const label = translateLabel(state.labels, "Open PDF");
  return (
    <Show when={() => position === undefined || Math.abs(position - state.globalIndex()) <= 1}>
      {() => (
        <object
          class={cls}
          data-lightbox-media=""
          data={slide.src}
          type="application/pdf"
          aria-label={slide.title ?? label}
          style={{ display: "block", border: "0", ...box, ...style } as never}
        >
          <a class={fallbackCls} href={slide.src} target="_blank" rel="noopener" download="">
            {fallback === undefined ? (slide.title ?? label) : renderSlot(fallback)}
          </a>
        </object>
      )}
    </Show>
  );
}
