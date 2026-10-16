// Port of the embla-carousel 8.6.0 "Scale" example (packages/embla-carousel-docs, Tween/Scale + SandboxFilesSrc/Scale, MIT,
// © David Jerleke): the tween reads embla's scroll progress on every `scroll` and scales each slide's content down with the distance to the selected snap.
import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import type { EmblaCarouselType, EmblaEventType } from "@rivetjs/cdk/carousel/engine";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Carousel scale tween" };

const slides = [1, 2, 3, 4, 5];

const TWEEN_FACTOR_BASE = 0.52;

const numberWithinRange = (number: number, min: number, max: number): number => Math.min(Math.max(number, min), max);

/** embla's scale tween: 1 on the selected snap, smaller with the distance to it (loop points included). */
function tweenScale(emblaApi: EmblaCarouselType, eventName?: EmblaEventType): void {
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
      const scale = numberWithinRange(tweenValue, 0, 1).toString();
      const tweenNode = emblaApi.slideNodes()[slideIndex].querySelector<HTMLElement>(".tween");
      if (tweenNode) tweenNode.style.transform = `scale(${scale})`;
    });
  });
}

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function ScaleCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel
        id="scale"
        aria-label="Scale tween"
        loop
        tabs
        style={{ "--rv-carousel-slide-size": "55%" }}
        onApi={(api) => {
          tweenScale(api);
          api.on("reInit", tweenScale).on("scroll", tweenScale).on("slideFocus", tweenScale);
        }}
      >
        <CarouselViewport>
          <CarouselContainer items={slides} class="-ml-4">
            {(slide: number) => (
              <CarouselSlide class="pl-4">
                <div class="tween flex h-48 select-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-4xl font-semibold text-slate-700 [backface-visibility:hidden]">
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
