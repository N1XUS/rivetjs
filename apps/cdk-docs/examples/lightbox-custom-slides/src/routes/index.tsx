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
import { ChevronLeft, ChevronRight, X } from "lucide";
import { Icon } from "../components/Icon.tsx";
import avocado from "../assets/avocado.jpg?url";
import cactus from "../assets/cactus.jpg?url";

export const head = { title: "Lightbox custom slides" };

const slides: LightboxSlide[] = [
  { src: avocado, alt: "Avocado half on pink", width: 640, height: 480 },
  { type: "quote", text: "Simplicity is the ultimate sophistication.", by: "Leonardo da Vinci" },
  { src: cactus, alt: "Cactus in a terracotta pot", width: 400, height: 440 },
];

// #region demo
export default function CustomSlidesLightbox() {
  const open = signal(false);
  return (
    <div class="m-4">
      <button id="open" type="button" class="rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white" onClick={() => open.set(true)}>
        Open
      </button>
      <Lightbox isOpen={open} slides={slides} index={1} aria-label="Slides" overlayClass="z-50 bg-black/90" class="text-white">
        {() => (
          <>
            <LightboxCarousel>
              {(slide) =>
                slide.type === "quote" ? (
                  <figure id="quote" class="max-w-md rounded-2xl bg-white p-8 text-slate-900">
                    <blockquote class="text-2xl font-semibold">{String(slide.text)}</blockquote>
                    <figcaption class="mt-4 text-slate-500">{String(slide.by)}</figcaption>
                  </figure>
                ) : (
                  <LightboxImage />
                )
              }
            </LightboxCarousel>
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
