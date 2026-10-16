// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Slides Per View" example (packages/embla-carousel-docs/src/components/Examples/Basic/SlidesPerView.tsx, MIT, © David Jerleke): same options and slides.
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Slides per view" };

const SLIDES = Array.from({ length: 6 }, (_, index) => index + 1);

// #region demo
export function CarouselSlidesPerView() {
  return (
    <Carousel
      id="carousel-slides-per-view"
      aria-label="Slides per view carousel"
      align="start"
      tabs
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] sm:[--rv-carousel-slide-size:50%] lg:[--rv-carousel-slide-size:33.333%]"
    >
      <Carousel.Content>
        {SLIDES.map((slide) => (
          <Carousel.Item>
            <div class="flex h-48 select-none items-center justify-center rounded-3xl bg-surface-secondary text-4xl font-semibold text-foreground">{slide}</div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-slides-per-view-prev" />
      <Carousel.Next id="carousel-slides-per-view-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselSlidesPerView />
    </div>
  );
}
