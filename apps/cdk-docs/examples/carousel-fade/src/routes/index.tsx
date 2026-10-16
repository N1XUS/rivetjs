// Port of the embla-carousel 8.6.0 "Fade" example (packages/embla-carousel-docs, Plugins/Fade + SandboxFilesSrc/Fade, MIT,
// © David Jerleke): the Fade plugin stacks the slides and cross-fades them instead of scrolling (loop, duration 30).
// Rivet: gradient tiles stand in for the upstream photos.
import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import Fade from "@rivetjs/cdk/carousel/fade";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Fade" };

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
export default function FadeCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel id="fade" aria-label="Fade" loop duration={30} tabs plugins={() => [Fade()]}>
        <CarouselViewport>
          <CarouselContainer items={slides} class="-ml-4">
            {(colors: string, index) => (
              <CarouselSlide class="pl-4">
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
