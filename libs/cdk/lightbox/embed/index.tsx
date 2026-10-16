// Rivet-authored (no YARL counterpart; YARL users render iframes through `render.slide`): an embed slide for YouTube
// (youtube-nocookie.com), Vimeo (`dnt=1`) or any iframe URL.
// - Privacy / cost: the iframe exists only while its slide is the current one (`<Show>` on the slide offset): neighbours
//   preloaded in the carousel window render the `poster` (or nothing), so a closed or unopened lightbox, and slides not
//   yet viewed, make no request to the provider. Leaving the slide unmounts the iframe, which stops playback.
// - Sizing is CSS only (slide box = size container): `width: min(100cqw, 100cqh × ratio)` + `aspect-ratio`.
import { Show } from "@rivetjs/runtime/dom";
import type { StyleObject } from "@rivetjs/runtime/style";
import { useLightbox, useLightboxSlide } from "../index.tsx";
import type { LightboxSlideEmbed } from "../state.ts";

/** The iframe URL of an embed slide (youtube-nocookie / player.vimeo.com with `dnt=1` / `src`). */
export function lightboxEmbedUrl(slide: LightboxSlideEmbed): string {
  if (slide.src) return slide.src;
  const id = encodeURIComponent(slide.id ?? "");
  const params = new URLSearchParams();
  if (slide.provider === "youtube") {
    params.set("rel", "0");
    params.set("playsinline", "1");
    if (slide.autoPlay) params.set("autoplay", "1");
    if (slide.muted) params.set("mute", "1");
    if (slide.start) params.set("start", String(Math.floor(slide.start)));
    return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
  }
  if (slide.provider === "vimeo") {
    params.set("dnt", "1");
    if (slide.autoPlay) params.set("autoplay", "1");
    if (slide.muted) params.set("muted", "1");
    return `https://player.vimeo.com/video/${id}?${params}${slide.start ? `#t=${Math.floor(slide.start)}s` : ""}`;
  }
  return "";
}

export interface LightboxEmbedProps {
  /** The embed slide (default: the enclosing carousel slide). */
  slide?: LightboxSlideEmbed;
  /** @default "rv-LightboxEmbed" */
  class?: string;
  style?: StyleObject;
  /** Class of the poster image shown while the slide is not current. @default "rv-LightboxEmbedPoster" */
  posterClass?: string;
}

/** An embed slide: an `<iframe>` mounted only while the slide is current (poster otherwise). */
export function LightboxEmbed(props: LightboxEmbedProps) {
  const state = useLightbox();
  const ctx = useLightboxSlide();
  const slide = (props.slide ?? ctx?.slide) as LightboxSlideEmbed;
  const position = ctx?.position;
  const cls = props.class ?? "rv-LightboxEmbed",
    style = props.style,
    posterCls = props.posterClass ?? "rv-LightboxEmbedPoster";
  const width = slide.width ?? 1280,
    height = slide.height ?? 720;
  const src = lightboxEmbedUrl(slide);
  const allow = slide.allow ?? "autoplay; fullscreen; picture-in-picture; encrypted-media";
  const poster = slide.poster;
  const box = {
    display: "block",
    border: "0",
    width: `min(100cqw, calc(100cqh * ${width} / ${height}))`,
    aspectRatio: `${width} / ${height}`,
    height: "auto",
    ...style,
  };
  return (
    <Show
      when={() => position === undefined || position === state.globalIndex()}
      fallback={() => (poster ? <img class={posterCls} src={poster} alt="" draggable={false} style={{ ...box, objectFit: "cover" } as never} /> : null)}
    >
      {() => (
        <iframe
          class={cls}
          data-lightbox-media=""
          src={src}
          title={slide.title}
          width={width}
          height={height}
          allow={allow}
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
          style={box as never}
        />
      )}
    </Show>
  );
}
