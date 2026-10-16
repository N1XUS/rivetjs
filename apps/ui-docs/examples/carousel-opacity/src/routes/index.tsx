// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Opacity" example (packages/embla-carousel-docs, Tween/Opacity + SandboxFilesSrc/Opacity, MIT, © David Jerleke):
// onApi listens to scroll and tweens the slides by their distance to the selected snap.
import type { EmblaCarouselType, EmblaEventType } from "@rivetjs/cdk/carousel/engine";
import { Carousel } from "@rivetjs/ui/carousel";
import bloomImage from "../assets/cover-bloom.jpg?image";
import duneImage from "../assets/cover-dune.jpg?image";
import emberImage from "../assets/cover-ember.jpg?image";
import pineImage from "../assets/cover-pine.jpg?image";
import tideImage from "../assets/cover-tide.jpg?image";

export const head = { title: "Carousel: Opacity" };

const SLIDES = [
  { src: pineImage.src, alt: "Misty pine forest on a hillside" },
  { src: duneImage.src, alt: "Sand dune ridges in late light" },
  { src: tideImage.src, alt: "Soft teal bands like calm waves" },
  { src: bloomImage.src, alt: "Pale pink flower petals" },
  { src: emberImage.src, alt: "Warm orange glow over a plum field" },
];

const numberWithinRange = (number: number, min: number, max: number): number => Math.min(Math.max(number, min), max);

const TWEEN_FACTOR_BASE = 0.84;

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

// #region demo
export function CarouselOpacity() {
  return (
    <Carousel
      id="carousel-opacity"
      aria-label="Opacity tween"
      loop
      tabs
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:70%]"
      onApi={(api) => {
        tweenOpacity(api);
        api.on("reInit", tweenOpacity).on("scroll", tweenOpacity).on("slideFocus", tweenOpacity);
      }}
    >
      <Carousel.Content>
        {SLIDES.map((slide) => (
          <Carousel.Item>
            <img src={slide.src} alt={slide.alt} class="block h-64 w-full select-none rounded-3xl object-cover" draggable={false} />
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-opacity-prev" />
      <Carousel.Next id="carousel-opacity-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselOpacity />
    </div>
  );
}
