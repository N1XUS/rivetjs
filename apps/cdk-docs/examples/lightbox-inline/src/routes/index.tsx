import { LightboxCarousel, LightboxNext, LightboxPrevious, type LightboxSlide } from "@rivetjs/cdk/lightbox";
import { LightboxCounter } from "@rivetjs/cdk/lightbox/counter";
import { LightboxInline } from "@rivetjs/cdk/lightbox/inline";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";
import avocado from "../assets/avocado.jpg?url";
import cactus from "../assets/cactus.jpg?url";
import cherries from "../assets/cherries.jpg?url";
import robot from "../assets/robot-face.jpg?url";

export const head = { title: "Inline lightbox in the page" };

const slides: LightboxSlide[] = [
  { src: robot, alt: "Knitted robot head", width: 880, height: 495, title: "Robot", description: "A knitted domestic robot, front view." },
  { src: avocado, alt: "Avocado half on pink", width: 640, height: 480, title: "Avocado", description: "One avocado half on a pastel background." },
  { src: cherries, alt: "Two cherries on mint", width: 640, height: 800, title: "Cherries" },
  { src: cactus, alt: "Cactus in a terracotta pot", width: 400, height: 440, title: "Cactus" },
];

// #region demo
export default function InlineLightbox() {
  return (
    <div class="m-4">
      <LightboxInline slides={slides} aria-label="Photos" class="h-64 w-96 overflow-hidden rounded-2xl bg-slate-900 text-white" carousel={{ finite: true }}>
        {() => (
          <>
            <LightboxCarousel />
            <LightboxPrevious class="absolute start-3 top-1/2 z-10 -translate-y-1/2 [grid-area:main] inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
              <Icon icon={ChevronLeft} size={20} />
            </LightboxPrevious>
            <LightboxNext class="absolute end-3 top-1/2 z-10 -translate-y-1/2 [grid-area:main] inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
              <Icon icon={ChevronRight} size={20} />
            </LightboxNext>
            <LightboxCounter class="absolute bottom-3 start-3 z-10 rounded-full bg-black/50 px-3 py-1 text-sm tabular-nums [grid-area:main]" />
          </>
        )}
      </LightboxInline>
    </div>
  );
}
// #endregion
