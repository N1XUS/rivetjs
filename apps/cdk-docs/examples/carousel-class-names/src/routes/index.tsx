// Port of the embla-carousel 8.6.0 "Class Names" example (packages/embla-carousel-docs, Plugins/ClassNames + SandboxFilesSrc/ClassNames,
// MIT, © David Jerleke): the ClassNames plugin toggles `is-snapped` (and is-in-view / is-draggable / is-dragging / is-loop);
// the CSS dims every slide that is not snapped. Rivet: the parts' `data-snapped` / `data-in-view` do the same without the plugin.
import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import ClassNames from "@rivetjs/cdk/carousel/class-names";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Class names" };

const slides = [
  "from-indigo-300 to-cyan-200",
  "from-rose-300 to-amber-200",
  "from-emerald-300 to-lime-200",
  "from-sky-300 to-violet-200",
  "from-orange-300 to-pink-200",
];

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function ClassNamesCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel id="classes" aria-label="Class names" tabs style={{ "--rv-carousel-slide-size": "70%" }} plugins={() => [ClassNames()]}>
        <CarouselViewport>
          <CarouselContainer items={slides} class="-ml-4">
            {(colors: string, index) => (
              <CarouselSlide class="slide pl-4">
                <div class={`flex h-48 select-none items-center justify-center rounded-xl bg-gradient-to-br ${colors} text-4xl font-semibold text-slate-700`}>
                  {index() + 1}
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
