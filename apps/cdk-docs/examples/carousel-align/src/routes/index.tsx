// Port of the embla-carousel 8.6.0 "Align" example (packages/embla-carousel-docs/src/components/Examples/Basic/Align.tsx,
// MIT, © David Jerleke): same options, slides and controls, on the @rivetjs/cdk/carousel parts.
import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Align and contain scroll" };

const slides = Array.from({ length: 5 }, (_, index) => index + 1);

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function AlignCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel id="align" aria-label="Align" containScroll={false} tabs style={{ "--rv-carousel-slide-size": "70%" }}>
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
