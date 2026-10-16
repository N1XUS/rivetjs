// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Scale" example (packages/embla-carousel-docs, Tween/Scale + SandboxFilesSrc/Scale, MIT, © David Jerleke):
// onApi listens to scroll and tweens the slides by their distance to the selected snap.
import type { EmblaCarouselType, EmblaEventType } from "@rivetjs/cdk/carousel/engine";
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Scale" };

const SLIDES = [1, 2, 3, 4, 5];

const numberWithinRange = (number: number, min: number, max: number): number => Math.min(Math.max(number, min), max);

const TWEEN_FACTOR_BASE = 0.52;

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

// #region demo
export function CarouselScale() {
  return (
    <Carousel
      id="carousel-scale"
      aria-label="Scale tween"
      loop
      tabs
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:55%]"
      onApi={(api) => {
        tweenScale(api);
        api.on("reInit", tweenScale).on("scroll", tweenScale).on("slideFocus", tweenScale);
      }}
    >
      <Carousel.Content>
        {SLIDES.map((slide) => (
          <Carousel.Item>
            <div class="tween flex h-48 select-none items-center justify-center rounded-3xl bg-surface-secondary text-4xl font-semibold text-foreground [backface-visibility:hidden]">
              {slide}
            </div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-scale-prev" />
      <Carousel.Next id="carousel-scale-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselScale />
    </div>
  );
}
