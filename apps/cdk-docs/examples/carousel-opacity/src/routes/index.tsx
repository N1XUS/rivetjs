// Port of the embla-carousel 8.6.0 "Opacity" example (packages/embla-carousel-docs, Tween/Opacity + SandboxFilesSrc/Opacity, MIT,
// © David Jerleke): the tween reads embla's scroll progress on every `scroll` and fades the slides away from the selected snap.
import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import type { EmblaCarouselType, EmblaEventType } from "@rivetjs/cdk/carousel/engine";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Carousel opacity tween" };

const slides = [
  "from-indigo-200 to-cyan-100",
  "from-rose-200 to-amber-100",
  "from-emerald-200 to-lime-100",
  "from-sky-200 to-violet-100",
  "from-orange-200 to-pink-100",
];

const TWEEN_FACTOR_BASE = 0.84;

const numberWithinRange = (number: number, min: number, max: number): number => Math.min(Math.max(number, min), max);

/** embla's opacity tween: 1 on the selected snap, fading with the distance to it (loop points included). */
function tweenOpacity(emblaApi: EmblaCarouselType, eventName?: EmblaEventType): void {
  const engine = emblaApi.internalEngine();
  const scrollProgress = emblaApi.scrollProgress();
  const slidesInView = emblaApi.slidesInView();
  const isScrollEvent = eventName === "scroll";
  const tweenFactor = TWEEN_FACTOR_BASE * emblaApi.scrollSnapList().length;

  emblaApi.scrollSnapList().forEach((scrollSnap, snapIndex) => {
    let diffToTarget = scrollSnap - scrollProgress;
    const slidesInSnap = engine.slideRegistry[snapIndex];

    slidesInSnap.forEach((slideIndex) => {
      if (isScrollEvent && !slidesInView.includes(slideIndex)) return;

      if (engine.options.loop) {
        engine.slideLooper.loopPoints.forEach((loopItem) => {
          const target = loopItem.target();
          if (slideIndex === loopItem.index && target !== 0) {
            const sign = Math.sign(target);
            if (sign === -1) diffToTarget = scrollSnap - (1 + scrollProgress);
            if (sign === 1) diffToTarget = scrollSnap + (1 - scrollProgress);
          }
        });
      }

      const tweenValue = 1 - Math.abs(diffToTarget * tweenFactor);
      emblaApi.slideNodes()[slideIndex].style.opacity = numberWithinRange(tweenValue, 0, 1).toString();
    });
  });
}

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function OpacityCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel
        id="opacity"
        aria-label="Opacity tween"
        loop
        tabs
        style={{ "--rv-carousel-slide-size": "70%" }}
        onApi={(api) => {
          tweenOpacity(api);
          api.on("reInit", tweenOpacity).on("scroll", tweenOpacity).on("slideFocus", tweenOpacity);
        }}
      >
        <CarouselViewport>
          <CarouselContainer items={slides} class="-ml-4">
            {(colors: string, index) => (
              <CarouselSlide class="pl-4">
                <div class={`flex h-48 items-center justify-center rounded-xl bg-gradient-to-br ${colors} text-4xl font-semibold text-slate-700`}>
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
