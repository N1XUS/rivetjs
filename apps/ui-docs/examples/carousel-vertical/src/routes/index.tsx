// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Vertical" };

const SLIDES = ["One", "Two", "Three", "Four"];

// #region demo
export function CarouselVertical() {
  return (
    <Carousel
      id="carousel-vertical"
      aria-label="Vertical carousel"
      orientation="vertical"
      tabs
      slideCount={SLIDES.length}
      class="w-72 [--carousel-height:16rem]"
    >
      <Carousel.Content>
        {SLIDES.map((name) => (
          <Carousel.Item>
            <div class="flex h-full items-center justify-center rounded-3xl bg-surface-secondary text-3xl font-semibold text-foreground">{name}</div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous />
      <Carousel.Next id="carousel-vertical-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselVertical />
    </div>
  );
}
