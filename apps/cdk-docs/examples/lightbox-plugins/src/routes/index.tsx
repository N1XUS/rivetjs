import { signal } from "@rivetjs/reactivity";
import { Lightbox, LightboxCarousel, LightboxClose, LightboxNext, LightboxPrevious, LightboxToolbar, type LightboxSlide } from "@rivetjs/cdk/lightbox";
import { LightboxCaptions, LightboxCaptionsToggle } from "@rivetjs/cdk/lightbox/captions";
import { LightboxCounter } from "@rivetjs/cdk/lightbox/counter";
import { LightboxDownload } from "@rivetjs/cdk/lightbox/download";
import { LightboxFullscreen } from "@rivetjs/cdk/lightbox/fullscreen";
import { LightboxShare } from "@rivetjs/cdk/lightbox/share";
import { LightboxSlideshow } from "@rivetjs/cdk/lightbox/slideshow";
import { LightboxThumbnails } from "@rivetjs/cdk/lightbox/thumbnails";
import { LightboxZoom, LightboxZoomIn, LightboxZoomOut } from "@rivetjs/cdk/lightbox/zoom";
import { Captions, ChevronLeft, ChevronRight, Download, Maximize, Pause, Play, Share2, X, ZoomIn, ZoomOut } from "lucide";
import { Icon } from "../components/Icon.tsx";
import avocado from "../assets/avocado.jpg?url";
import cactus from "../assets/cactus.jpg?url";
import cherries from "../assets/cherries.jpg?url";
import robot from "../assets/robot-face.jpg?url";

export const head = { title: "Lightbox with zoom, captions, counter, thumbnails and toolbar plugins" };

const slides: LightboxSlide[] = [
  { src: robot, alt: "Knitted robot head", width: 880, height: 495, title: "Robot", description: "A knitted domestic robot, front view." },
  { src: avocado, alt: "Avocado half on pink", width: 640, height: 480, title: "Avocado", description: "One avocado half on a pastel background." },
  { src: cherries, alt: "Two cherries on mint", width: 640, height: 800, title: "Cherries" },
  { src: cactus, alt: "Cactus in a terracotta pot", width: 400, height: 440, title: "Cactus" },
];

// #region demo
export default function PluginsLightbox() {
  const open = signal(false);
  const index = signal(0);
  return (
    <div class="m-4 w-96">
      <div class="grid grid-cols-4 gap-2">
        {slides.map((slide, i) => (
          <button
            id={`thumb-${i}`}
            type="button"
            class="overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-indigo-500"
            aria-label={`Open ${(slide as { alt: string }).alt}`}
            onClick={() => {
              index.set(i);
              open.set(true);
            }}
          >
            <img src={(slide as { src: string }).src} alt="" class="aspect-square w-full object-cover" />
          </button>
        ))}
      </div>
      <Lightbox isOpen={open} index={index} slides={slides} aria-label="Photos" overlayClass="z-50 bg-black/90" class="text-white">
        {() => (
          <>
            <LightboxCarousel />
            <LightboxZoom maxZoomPixelRatio={2} />
            <LightboxToolbar class="absolute end-0 top-0 z-10 flex gap-2 p-3 [grid-area:main]">
              <LightboxZoomIn class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
                <Icon icon={ZoomIn} size={20} />
              </LightboxZoomIn>
              <LightboxZoomOut class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
                <Icon icon={ZoomOut} size={20} />
              </LightboxZoomOut>
              <LightboxCaptionsToggle class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0 aria-pressed:bg-white/30">
                <Icon icon={Captions} size={20} />
              </LightboxCaptionsToggle>
              <LightboxSlideshow class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
                {(playing: () => boolean) => <Icon icon={playing() ? Pause : Play} size={20} />}
              </LightboxSlideshow>
              <LightboxFullscreen class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0 [&[hidden]]:hidden">
                <Icon icon={Maximize} size={20} />
              </LightboxFullscreen>
              <LightboxDownload class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
                <Icon icon={Download} size={20} />
              </LightboxDownload>
              <LightboxShare class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0 [&[hidden]]:hidden">
                <Icon icon={Share2} size={20} />
              </LightboxShare>
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
            <LightboxCounter class="absolute start-3 top-3 z-10 rounded-full bg-black/50 px-3 py-1 text-sm tabular-nums [grid-area:main]" />
            <LightboxCaptions
              class="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/80 to-transparent px-6 pt-10 pb-4 [grid-area:main]"
              titleClass="font-semibold"
              descriptionClass="text-sm text-white/80"
            />
            <LightboxThumbnails
              width={64}
              height={48}
              class="bg-black/40"
              thumbnailClass="cursor-pointer border-white/20 opacity-60 data-current:border-white data-current:opacity-100"
            />
          </>
        )}
      </Lightbox>
    </div>
  );
}
// #endregion
