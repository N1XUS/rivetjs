// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Loop" };

const SLIDES = ["One", "Two", "Three", "Four"];

// #region demo
export function CarouselLoop() {
  return (
    <Carousel id="carousel-loop" aria-label="Looping carousel" tabs loop slideCount={SLIDES.length} class="w-80">
      <Carousel.Content>
        {SLIDES.map((name) => (
          <Carousel.Item>
            <div class="flex h-48 items-center justify-center rounded-3xl bg-accent-soft text-3xl font-semibold text-foreground">{name}</div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-loop-prev" />
      <Carousel.Next />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselLoop />
    </div>
  );
}
