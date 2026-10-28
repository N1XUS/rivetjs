// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the shadcn/ui "carousel-spacing" Carousel demo (apps/v4/registry/new-york-v4/examples/carousel-spacing.tsx, MIT, © shadcn):
// Same slides and spacing on the ui Carousel, aligned to the start so Next advances the leading slide.
// shadcn's CarouselPrevious / CarouselNext sit outside: placement="outside".
import { Card } from "@rivetjs/ui/card";
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: shadcn spacing" };

const SLIDES = Array.from({ length: 5 });

// #region demo
export function CarouselShadcnSpacing() {
  return (
    <Carousel
      id="carousel-shadcn-spacing"
      aria-label="Spacing"
      align="start"
      placement="outside"
      slideCount={SLIDES.length}
      class="w-full max-w-sm [--carousel-gap:0.25rem] md:[--rv-carousel-slide-size:50%] lg:[--rv-carousel-slide-size:33.333%]"
    >
      <Carousel.Content>
        {SLIDES.map((_, index) => (
          <Carousel.Item>
            <div class="p-1">
              <Card>
                <Card.Content class="flex aspect-square items-center justify-center p-6">
                  <span class="text-2xl font-semibold">{index + 1}</span>
                </Card.Content>
              </Card>
            </div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-shadcn-spacing-prev" variant="secondary" />
      <Carousel.Next id="carousel-shadcn-spacing-next" variant="secondary" />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CarouselShadcnSpacing />
    </div>
  );
}
