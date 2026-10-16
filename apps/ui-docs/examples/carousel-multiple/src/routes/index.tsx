// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Multiple per view" };

const SLIDES = Array.from({ length: 8 }, (_, i) => String(i + 1));

// #region demo
export function CarouselMultiple() {
  return (
    <Carousel
      aria-label="Products"
      align="start"
      size="sm"
      placement="outside"
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:33.333%]"
    >
      <Carousel.Content>
        {SLIDES.map((name) => (
          <Carousel.Item>
            <div class="flex aspect-square items-center justify-center rounded-2xl bg-surface-secondary text-2xl font-semibold text-foreground">{name}</div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-multiple-prev" />
      <Carousel.Next id="carousel-multiple-next" />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselMultiple />
    </div>
  );
}
