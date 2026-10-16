// Port of the embla-carousel 8.6.0 "Slides Per View" example (packages/embla-carousel-docs/src/components/Examples/Basic/SlidesPerView.tsx,
// MIT, © David Jerleke): same options, slides and controls, on the @rivetjs/cdk/carousel parts.
import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Responsive slides per view" };

const slides = Array.from({ length: 6 }, (_, index) => index + 1);

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function SlidesPerViewCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel
        id="per-view"
        aria-label="Slides per view"
        align="start"
        tabs
        class="[--rv-carousel-slide-size:100%] sm:[--rv-carousel-slide-size:50%] lg:[--rv-carousel-slide-size:33.333%]"
      >
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
          <CarouselDots class="flex flex-wrap justify-end gap-2">
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
