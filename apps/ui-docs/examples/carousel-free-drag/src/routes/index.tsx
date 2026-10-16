// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Free drag" };

const SLIDES = Array.from({ length: 10 }, (_, i) => String(i + 1));

// #region demo
export function CarouselFreeDrag() {
  return (
    <Carousel
      id="carousel-free-drag"
      aria-label="Free drag carousel"
      dragFree
      align="start"
      slideCount={SLIDES.length}
      class="w-[min(32rem,100%)] [--rv-carousel-slide-size:40%]"
    >
      <Carousel.Content>
        {SLIDES.map((name) => (
          <Carousel.Item>
            <div class="flex h-36 items-center justify-center rounded-2xl bg-surface-secondary text-2xl font-semibold text-foreground">{name}</div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-free-drag-prev" />
      <Carousel.Next />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselFreeDrag />
    </div>
  );
}
