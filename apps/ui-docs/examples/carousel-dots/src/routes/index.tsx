// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Dots" };

const SLIDES = ["One", "Two", "Three", "Four", "Five", "Six"];

// #region demo
export function CarouselDots() {
  return (
    <Carousel id="carousel-dots" aria-label="Dots carousel" tabs slideCount={SLIDES.length} class="w-80">
      <Carousel.Content>
        {SLIDES.map((name) => (
          <Carousel.Item>
            <div class="flex h-48 items-center justify-center rounded-3xl bg-default text-3xl font-semibold text-foreground">{name}</div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselDots />
    </div>
  );
}
