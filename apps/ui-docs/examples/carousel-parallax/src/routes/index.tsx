// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Parallax" example (packages/embla-carousel-docs, Tween/Parallax + SandboxFilesSrc/Parallax, MIT, © David Jerleke):
// onApi listens to scroll and tweens the slides by their distance to the selected snap.
import type { EmblaCarouselType, EmblaEventType } from "@rivetjs/cdk/carousel/engine";
import { Carousel } from "@rivetjs/ui/carousel";
import bloomImage from "../assets/cover-bloom.jpg?image";
import duneImage from "../assets/cover-dune.jpg?image";
import emberImage from "../assets/cover-ember.jpg?image";
import pineImage from "../assets/cover-pine.jpg?image";
import tideImage from "../assets/cover-tide.jpg?image";

export const head = { title: "Carousel: Parallax" };

const SLIDES = [
  { src: pineImage.src, alt: "Misty pine forest on a hillside" },
  { src: duneImage.src, alt: "Sand dune ridges in late light" },
  { src: tideImage.src, alt: "Soft teal bands like calm waves" },
  { src: bloomImage.src, alt: "Pale pink flower petals" },
  { src: emberImage.src, alt: "Warm orange glow over a plum field" },
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

// #region demo
export function CarouselParallax() {
  return (
    <Carousel
      id="carousel-parallax"
      aria-label="Parallax tween"
      loop
      dragFree
      tabs
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:80%]"
      onApi={(api) => {
        tweenParallax(api);
        api.on("reInit", tweenParallax).on("scroll", tweenParallax).on("slideFocus", tweenParallax);
      }}
    >
      <Carousel.Content>
        {SLIDES.map((slide) => (
          <Carousel.Item>
            <div class="h-64 overflow-hidden rounded-3xl">
              <div class="parallax-layer relative flex h-full w-full justify-center">
                <img
                  src={slide.src}
                  alt={slide.alt}
                  class="h-full max-w-none flex-[0_0_calc(115%+var(--carousel-gap)*2)] select-none object-cover"
                  draggable={false}
                />
              </div>
            </div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-parallax-prev" />
      <Carousel.Next id="carousel-parallax-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselParallax />
    </div>
  );
}
