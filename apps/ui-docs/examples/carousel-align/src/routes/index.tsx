// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Align" example (packages/embla-carousel-docs/src/components/Examples/Basic/Align.tsx, MIT, © David Jerleke): same options and slides.
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Align" };

const SLIDES = Array.from({ length: 5 }, (_, index) => index + 1);

// #region demo
export function CarouselAlign() {
  return (
    <Carousel
      id="carousel-align"
      aria-label="Align carousel"
      containScroll={false}
      tabs
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:70%]"
    >
      <Carousel.Content>
        {SLIDES.map((slide) => (
          <Carousel.Item>
            <div class="flex h-48 select-none items-center justify-center rounded-3xl bg-surface-secondary text-4xl font-semibold text-foreground">{slide}</div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-align-prev" />
      <Carousel.Next id="carousel-align-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselAlign />
    </div>
  );
}
