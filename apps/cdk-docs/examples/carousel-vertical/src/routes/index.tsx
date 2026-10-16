import { Carousel, CarouselContainer, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { ChevronDown, ChevronUp } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Vertical carousel" };

const steps = ["Plan", "Build", "Test", "Ship"];

// #region demo
export default function VerticalCarousel() {
  return (
    <div class="m-4 flex w-80 items-center gap-3">
      <Carousel id="steps" aria-label="Steps" axis="y" class="flex flex-1 items-center gap-3">
        <CarouselViewport class="h-44 flex-1 rounded-xl">
          <CarouselContainer items={steps} class="h-44">
            {(name: string) => (
              <CarouselSlide class="py-1">
                <div class="flex h-full items-center justify-center rounded-xl bg-gradient-to-b from-indigo-100 to-cyan-100 text-xl font-semibold">{name}</div>
              </CarouselSlide>
            )}
          </CarouselContainer>
        </CarouselViewport>
        <div class="flex flex-col gap-2">
          <CarouselPrevious
            id="prev"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
          >
            <Icon icon={ChevronUp} size={18} />
          </CarouselPrevious>
          <CarouselNext
            id="next"
            class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
          >
            <Icon icon={ChevronDown} size={18} />
          </CarouselNext>
        </div>
      </Carousel>
    </div>
  );
}
// #endregion
