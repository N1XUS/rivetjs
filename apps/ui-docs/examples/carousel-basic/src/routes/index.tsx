// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Basic" };

const SLIDES = ["One", "Two", "Three", "Four", "Five"];

// #region demo
export function CarouselBasic() {
  return (
    <Carousel aria-label="Basic carousel" tabs slideCount={SLIDES.length} class="w-80">
      <Carousel.Content>
        {SLIDES.map((name) => (
          <Carousel.Item>
            <div class="flex h-48 items-center justify-center rounded-3xl bg-surface-secondary text-3xl font-semibold text-foreground">{name}</div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous />
      <Carousel.Next id="carousel-basic-next" />
      <Carousel.Counter id="carousel-basic-counter" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselBasic />
    </div>
  );
}
