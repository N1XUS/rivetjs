// Ported from yet-another-react-lightbox (src/plugins/video/{Video.tsx,VideoSlide.tsx,props.ts}, v3.32.2), MIT,
// © Igor Danchenko.
// Rivet:
// - A part (`<LightboxVideo />` inside the carousel's slide render function) instead of a plugin that augments
//   `render.slide`; options = YARL `video` props (plugin defaults) overridden per slide.
// - Sizing is CSS only (the slide box is a size container): `width: min(100cqw, 100cqh × ratio)` + `aspect-ratio`
//   (YARL measures the slide rect).
// - Autoplay when viewed / pause when left: `syncLightboxMedia` (core, DOM-driven after each slide change) plays the
//   current slide's `video[data-autoplay]` and pauses the others (YARL: `autoPlay` attribute + pause on `!isActive`), so
//   neighbours preloaded in the DOM never play.
// - `onClick` of the lightbox fires for the current video (YARL: media click).
import type { StyleObject } from "@rivetjs/runtime/style";
import { useLightbox, useLightboxSlide } from "../index.tsx";
import type { LightboxSlideVideo, LightboxVideoOptions } from "../state.ts";
import { dataBool } from "../../utils/data-attrs.tsx";

/** Video plugin defaults (YARL `VideoProps`). */
export const LIGHTBOX_VIDEO_DEFAULTS: LightboxVideoOptions = { controls: true, playsInline: true };

export interface LightboxVideoProps extends LightboxVideoOptions {
  /** The video slide (default: the enclosing carousel slide). */
  slide?: LightboxSlideVideo;
  /** @default "rv-LightboxVideo" */
  class?: string;
  style?: StyleObject;
}

/** A video slide: native `<video>` with `<source>`s, poster, controls; autoplays when viewed, pauses when left. */
export function LightboxVideo(props: LightboxVideoProps) {
  const state = useLightbox();
  const ctx = useLightboxSlide();
  const slide = (props.slide ?? ctx?.slide) as LightboxSlideVideo;
  const position = ctx?.position;
  const index = ctx?.index ?? 0;
  const o: LightboxVideoOptions = { ...LIGHTBOX_VIDEO_DEFAULTS };
  for (const key of [
    "autoPlay",
    "controls",
    "controlsList",
    "crossOrigin",
    "preload",
    "loop",
    "muted",
    "playsInline",
    "disablePictureInPicture",
    "disableRemotePlayback",
  ] as const) {
    if (props[key] !== undefined) o[key] = props[key] as never;
    if (slide[key] !== undefined) o[key] = slide[key] as never;
  }
  const cls = props.class ?? "rv-LightboxVideo",
    style = props.style;
  const width = slide.width,
    height = slide.height;
  const sized: Record<string, string> =
    width && height
      ? { width: `min(100cqw, ${width}px, calc(100cqh * ${width} / ${height}))`, aspectRatio: `${width} / ${height}`, height: "auto" }
      : { maxWidth: "100%", maxHeight: "100%" };
  const on = state.on;
  return (
    <video
      class={cls}
      data-lightbox-media=""
      data-autoplay={dataBool(o.autoPlay)}
      poster={slide.poster}
      controls={o.controls}
      controlsList={o.controlsList}
      crossOrigin={o.crossOrigin as never}
      preload={o.preload ?? "metadata"}
      loop={o.loop}
      muted={o.muted}
      playsInline={o.playsInline}
      disablePictureInPicture={o.disablePictureInPicture}
      disableRemotePlayback={o.disableRemotePlayback}
      width={width}
      height={height}
      style={{ display: "block", minWidth: "0", minHeight: "0", ...sized, ...style } as never}
      onClick={() => {
        if (position === undefined || position === state.globalIndex()) on.onClick?.({ index });
      }}
    >
      {slide.sources.map((source) => (
        <source src={source.src} type={source.type} media={source.media} />
      ))}
    </video>
  );
}
