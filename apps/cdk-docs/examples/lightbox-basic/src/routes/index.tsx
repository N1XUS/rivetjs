import { signal } from "@rivetjs/reactivity";
import { Lightbox, LightboxCarousel, LightboxClose, LightboxNext, LightboxPrevious, LightboxToolbar, type LightboxSlide } from "@rivetjs/cdk/lightbox";
import { ChevronLeft, ChevronRight, X } from "lucide";
import { Icon } from "../components/Icon.tsx";
import avocado from "../assets/avocado.jpg?url";
import cactus from "../assets/cactus.jpg?url";
import cherries from "../assets/cherries.jpg?url";
import robot from "../assets/robot-face.jpg?url";

export const head = { title: "Lightbox opened from a thumbnail grid" };

const slides: LightboxSlide[] = [
  { src: robot, alt: "Knitted robot head", width: 880, height: 495, title: "Robot", description: "A knitted domestic robot, front view." },
  { src: avocado, alt: "Avocado half on pink", width: 640, height: 480, title: "Avocado", description: "One avocado half on a pastel background." },
  { src: cherries, alt: "Two cherries on mint", width: 640, height: 800, title: "Cherries" },
  { src: cactus, alt: "Cactus in a terracotta pot", width: 400, height: 440, title: "Cactus" },
];

// #region demo
export default function BasicLightbox() {
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
