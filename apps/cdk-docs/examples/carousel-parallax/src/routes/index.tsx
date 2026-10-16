// Port of the embla-carousel 8.6.0 "Parallax" example (packages/embla-carousel-docs, Tween/Parallax + SandboxFilesSrc/Parallax, MIT,
// © David Jerleke): the tween reads embla's scroll progress on every `scroll` and shifts each slide's
// wider inner layer against the scroll. Rivet: banded gradient scenes stand in for the upstream photos.
import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import type { EmblaCarouselType, EmblaEventType } from "@rivetjs/cdk/carousel/engine";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Carousel parallax tween" };

// Banded "landscapes" (sky, hills, ground): wide enough (115% + the gaps) for the layer to slide.
const slides = [
  "from-sky-300 via-indigo-200 to-emerald-300",
  "from-amber-200 via-rose-200 to-violet-300",
  "from-cyan-200 via-teal-200 to-lime-300",
  "from-violet-300 via-sky-200 to-slate-300",
  "from-orange-200 via-pink-200 to-indigo-300",
];

const TWEEN_FACTOR_BASE = 0.2;

/** embla's parallax tween: the layer moves against the scroll by the distance to the snap (loop points included). */
function tweenParallax(emblaApi: EmblaCarouselType, eventName?: EmblaEventType): void {
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

      const translate = diffToTarget * (-1 * tweenFactor) * 100;
      const tweenNode = emblaApi.slideNodes()[slideIndex].querySelector<HTMLElement>(".parallax-layer");
      if (tweenNode) tweenNode.style.transform = `translateX(${translate}%)`;
    });
  });
}

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function ParallaxCarousel() {
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel
        id="parallax"
        aria-label="Parallax tween"
        dragFree
        loop
        tabs
        style={{ "--rv-carousel-slide-size": "80%" }}
        onApi={(api) => {
          tweenParallax(api);
          api.on("reInit", tweenParallax).on("scroll", tweenParallax).on("slideFocus", tweenParallax);
        }}
      >
        <CarouselViewport>
          <CarouselContainer items={slides} class="-ml-4">
            {(colors: string, index) => (
              <CarouselSlide class="pl-4">
                <div class="h-48 overflow-hidden rounded-xl">
                  <div class="parallax-layer relative flex h-full w-full justify-center">
                    <div
                      class={`flex h-full flex-none basis-[calc(115%+2rem)] items-center justify-center bg-gradient-to-r ${colors} text-4xl font-semibold text-slate-700`}
                    >
                      {index() + 1}
                    </div>
                  </div>
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
