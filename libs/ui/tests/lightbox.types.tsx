// Type-level suite (`tsc -p libs/ui` only): `Lightbox` root accepts the cdk state / overlay props + `backdrop`, compound parts
// and `Lightbox["…Props"]`, carousel render function, plugin parts' options; errors: unknown backdrop, a non-object slide,
// thumbnails `children` that is not a function of the slide.
import { signal } from "@rivetjs/reactivity";
import {
  Lightbox,
  LightboxCaptions,
  LightboxCounter,
  LightboxFullscreen,
  LightboxInline,
  LightboxSlideshow,
  LightboxThumbnails,
  LightboxZoom,
  LightboxZoomIn,
} from "../src/components/lightbox/index.ts";
import type { LightboxSlide } from "../src/components/lightbox/index.ts";

const open = signal(false);
const index = signal(0);
const slides: LightboxSlide[] = [
  { src: "/a.jpg", alt: "A", width: 800, height: 600, srcSet: [{ src: "/a-400.jpg", width: 400, height: 300 }] },
  { type: "video", poster: "/p.jpg", sources: [{ src: "/v.mp4", type: "video/mp4" }] },
  { type: "embed", provider: "youtube", id: "x" },
  { type: "pdf", src: "/d.pdf" },
];

export const ok = () => (
  <>
    <Lightbox
      isOpen={open}
      index={index}
      slides={slides}
      backdrop="blur"
      class="x"
      backdropClass="y"
      containerClass="z"
      carousel={{ finite: true, preload: 1 }}
      animation={{ swipe: 300 }}
      controller={{ closeOnBackdropClick: true }}
      onView={({ index: i }) => void i}
    >
      {() => (
        <>
          <Lightbox.Slides>{(slide) => (slide.type === "pdf" ? <Lightbox.Media /> : <Lightbox.Image />)}</Lightbox.Slides>
          <LightboxZoom maxZoomPixelRatio={2} />
          <Lightbox.Toolbar>
            <LightboxZoomIn />
            <LightboxFullscreen auto={false} />
            <LightboxSlideshow delay={2000} />
            <Lightbox.Close />
          </Lightbox.Toolbar>
          <Lightbox.Previous />
          <Lightbox.Next />
          <LightboxCounter separator="of" />
          <LightboxCaptions descriptionMaxLines={2} />
          <LightboxThumbnails position="start">{(slide) => <span>{slide.type}</span>}</LightboxThumbnails>
        </>
      )}
    </Lightbox>
    <LightboxInline slides={slides} aria-label="Gallery" />
  </>
);

type P = Lightbox["Props"];
export const props: P = { slides, backdrop: "opaque" };

// @ts-expect-error unknown backdrop variant
export const badBackdrop = () => <Lightbox slides={slides} backdrop="glass" />;
// @ts-expect-error a slide is an object
export const badSlide: LightboxSlide = "a.jpg";
// @ts-expect-error thumbnails children render by slide (not plain content)
export const badThumbs = () => <LightboxThumbnails children={42} />;
