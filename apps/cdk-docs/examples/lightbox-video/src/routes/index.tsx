import { signal } from "@rivetjs/reactivity";
import {
  Lightbox,
  LightboxCarousel,
  LightboxClose,
  LightboxImage,
  LightboxNext,
  LightboxPrevious,
  LightboxToolbar,
  type LightboxSlide,
} from "@rivetjs/cdk/lightbox";
import { LightboxVideo } from "@rivetjs/cdk/lightbox/video";
import { ChevronLeft, ChevronRight, Play, X } from "lucide";
import { Icon } from "../components/Icon.tsx";
import robot from "../assets/robot-face.jpg?url";
import clip from "../assets/lightbox-clip.mp4?url";
import poster from "../assets/lightbox-clip-poster.jpg?url";

export const head = { title: "Lightbox video slides" };

const slides: LightboxSlide[] = [
  { type: "video", poster, width: 384, height: 216, autoPlay: true, muted: true, loop: true, sources: [{ src: clip, type: "video/mp4" }] },
  { src: robot, alt: "Knitted robot head", width: 880, height: 495 },
];

// #region demo
export default function VideoLightbox() {
  const open = signal(false);
  return (
    <div class="m-4">
      <button
        id="open"
        type="button"
        class="relative overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-indigo-500"
        aria-label="Play the clip"
        onClick={() => open.set(true)}
      >
        <img src={poster} alt="" class="w-64" />
        <span class="absolute inset-0 flex items-center justify-center bg-black/20 text-white">
          <Icon icon={Play} size={40} />
        </span>
      </button>
      <Lightbox isOpen={open} slides={slides} aria-label="Clip" overlayClass="z-50 bg-black/90" class="text-white">
        {() => (
          <>
            <LightboxCarousel>{(slide) => (slide.type === "video" ? <LightboxVideo class="rounded-xl" /> : <LightboxImage />)}</LightboxCarousel>
            <LightboxToolbar class="absolute end-0 top-0 z-10 flex gap-2 p-3 [grid-area:main]">
              <LightboxClose class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
                <Icon icon={X} size={20} />
              </LightboxClose>
            </LightboxToolbar>
            <LightboxPrevious class="absolute start-3 top-1/2 z-10 -translate-y-1/2 [grid-area:main] inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
              <Icon icon={ChevronLeft} size={20} />
            </LightboxPrevious>
            <LightboxNext class="absolute end-3 top-1/2 z-10 -translate-y-1/2 [grid-area:main] inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
              <Icon icon={ChevronRight} size={20} />
            </LightboxNext>
          </>
        )}
      </Lightbox>
    </div>
  );
}
// #endregion
