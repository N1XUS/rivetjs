import { Carousel, CarouselContainer, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Carousel with previous and next buttons" };

const landscapes = ["Alpine", "Coast", "Desert", "Forest", "Glacier"];

// #region demo
export default function BasicCarousel() {
  return (
    <div class="m-4 w-80">
      <Carousel id="gallery" aria-label="Landscapes">
        <CarouselViewport class="rounded-xl">
          <CarouselContainer items={landscapes}>
            {(name: string) => (
              <CarouselSlide class="px-1">
                <div class="flex h-40 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-100 to-cyan-100 text-xl font-semibold text-slate-700">
                  {name}
                </div>
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
