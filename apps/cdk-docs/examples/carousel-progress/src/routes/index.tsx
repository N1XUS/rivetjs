// Port of the embla-carousel 8.6.0 "Progress" example (packages/embla-carousel-docs, Miscellaneous/Progress + SandboxFilesSrc/Progress,
// MIT, © David Jerleke): a bar that follows embla's scrollProgress() on every scroll (dragFree, 65% slides).
// Rivet: `state.scrollProgress` is the carousel state's mirror of embla's `scroll` event — no listener needed.
import { Carousel, CarouselContainer, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Scroll progress" };

const slides = [1, 2, 3, 4, 5];

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function ProgressCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel id="progress" aria-label="Scroll progress" dragFree style={{ "--rv-carousel-slide-size": "65%" }}>
        {({ state }) => (
          <>
            <CarouselViewport>
              <CarouselContainer items={slides} class="-ml-4">
                {(slide: number) => (
                  <CarouselSlide class="pl-4">
                    <div class="flex h-40 select-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-4xl font-semibold text-slate-700">
                      {slide}
                    </div>
                  </CarouselSlide>
                )}
              </CarouselContainer>
            </CarouselViewport>
            <div class="mt-4 flex items-center justify-between gap-2">
              <div class="flex gap-2">
                <CarouselPrevious id="prev" class={button}>
                  <Icon icon={ChevronLeft} size={18} />
                </CarouselPrevious>
                <CarouselNext id="next" class={button}>
                  <Icon icon={ChevronRight} size={18} />
                </CarouselNext>
              </div>
              <div class="relative h-1.5 w-52 max-w-[90%] overflow-hidden rounded-full border border-slate-200 bg-white">
                <div
                  id="progress-bar"
                  class="absolute inset-y-0 -left-full w-full bg-slate-700"
                  style={{ transform: `translate3d(${Math.max(0, Math.min(1, state.scrollProgress())) * 100}%,0px,0px)` }}
                />
              </div>
            </div>
          </>
        )}
      </Carousel>
    </div>
  );
}
// #endregion
