// Port of the embla-carousel 8.6.0 "Variable Widths" example (packages/embla-carousel-docs/src/components/Examples/Basic/VariableWidths.tsx,
// MIT, © David Jerleke): same options, slides and controls, on the @rivetjs/cdk/carousel parts.
import { Carousel, CarouselContainer, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Slides of variable widths" };

const slides = ["60%", "40%", "30%", "90%", "35%", "55%", "85%", "50%", "35%"].map((width, index) => ({ number: index + 1, width }));

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function VariableWidthsCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel id="widths" aria-label="Variable widths">
        {({ selectedIndex, snapCount }) => (
          <>
            <CarouselViewport>
              <CarouselContainer items={slides} class="-ml-4">
                {(slide: { number: number; width: string }) => (
                  <CarouselSlide class="pl-4" style={{ "--rv-carousel-slide-size": slide.width }}>
                    <div class="flex h-40 select-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-4xl font-semibold text-slate-700">
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
              <span id="snap" class="font-semibold text-slate-500">
                {selectedIndex() + 1} / {snapCount()}
              </span>
            </div>
          </>
        )}
      </Carousel>
    </div>
  );
}
// #endregion
