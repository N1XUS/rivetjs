// Port of the embla-carousel 8.6.0 "Auto Scroll" example (packages/embla-carousel-docs, Plugins/AutoScroll + SandboxFilesSrc/AutoScroll,
// MIT, © David Jerleke): AutoScroll with playOnInit off on a looping track and a Start / Stop button.
// Rivet: the button is the APG CarouselRotationControl; hover pauses the scroll (W3C APG).
import { Carousel, CarouselContainer, CarouselNext, CarouselPrevious, CarouselRotationControl, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Auto scroll" };

const slides = [1, 2, 3, 4, 5, 6, 7, 8];

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function AutoScrollCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel id="ticker" aria-label="Auto scroll" loop autoScroll={{ playOnInit: false }} style={{ "--rv-carousel-slide-size": "45%" }}>
        {({ isRotating }) => (
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
              <CarouselRotationControl
                id="play"
                startLabel="Start auto scroll"
                stopLabel="Stop auto scroll"
                class="h-9 min-w-16 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 data-[hovered]:bg-slate-50 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
              >
                {() => (isRotating() ? "Stop" : "Start")}
              </CarouselRotationControl>
            </div>
          </>
        )}
      </Carousel>
    </div>
  );
}
// #endregion
