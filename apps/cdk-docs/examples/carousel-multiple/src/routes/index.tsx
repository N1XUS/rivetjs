import { Carousel, CarouselContainer, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Several slides per view" };

const cards = Array.from({ length: 9 }, (_, i) => `Card ${i + 1}`);

// #region demo
export default function MultipleCarousel() {
  return (
    <div class="m-4 w-[28rem]">
      <Carousel id="cards" aria-label="Cards" align="start" slidesToScroll={3} style={{ "--rv-carousel-slide-size": "33.333%" }}>
        <CarouselViewport>
          <CarouselContainer items={cards}>
            {(name: string) => (
              <CarouselSlide class="px-1">
                <div class="flex h-28 items-center justify-center rounded-lg bg-slate-100 font-medium data-[snapped]:bg-indigo-100">{name}</div>
              </CarouselSlide>
            )}
          </CarouselContainer>
        </CarouselViewport>
        <div class="mt-3 flex items-center justify-end gap-2">
          <CarouselPrevious
            id="prev"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
          >
            <Icon icon={ChevronLeft} size={18} />
          </CarouselPrevious>
          <CarouselNext
            id="next"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
          >
            <Icon icon={ChevronRight} size={18} />
          </CarouselNext>
        </div>
      </Carousel>
    </div>
  );
}
// #endregion
