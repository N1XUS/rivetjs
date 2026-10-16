// Port of the embla-carousel 8.6.0 "Auto Height" example (packages/embla-carousel-docs, Plugins/AutoHeight + SandboxFilesSrc/AutoHeight,
// MIT, © David Jerleke): the AutoHeight plugin sets the track height to the tallest slide of the selected snap.
import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import AutoHeight from "@rivetjs/cdk/carousel/auto-height";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Auto height" };

// Slide heights of the upstream example: 19rem, +4rem, -2rem, +2rem, 19rem (scaled down).
const slides = [
  { number: 1, height: "h-40" },
  { number: 2, height: "h-56" },
  { number: 3, height: "h-32" },
  { number: 4, height: "h-48" },
  { number: 5, height: "h-40" },
];

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function AutoHeightCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel id="heights" aria-label="Auto height" tabs plugins={() => [AutoHeight()]}>
        <CarouselViewport>
          <CarouselContainer items={slides} by={(slide) => slide.number} class="-ml-4 items-start transition-[height] duration-200">
            {(slide: { number: number; height: string }) => (
              <CarouselSlide class="pl-4">
                <div
                  class={`flex ${slide.height} select-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-4xl font-semibold text-slate-700`}
                >
                  {slide.number}
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
          <CarouselDots class="flex gap-2">
            {(index) => (
              <CarouselDot
                index={index}
                class="h-2.5 w-2.5 rounded-full bg-slate-300 data-[selected]:bg-indigo-600 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
              />
            )}
          </CarouselDots>
        </div>
      </Carousel>
    </div>
  );
}
// #endregion
