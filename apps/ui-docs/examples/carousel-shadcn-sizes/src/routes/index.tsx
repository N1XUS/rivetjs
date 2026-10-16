// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the shadcn/ui "carousel-size" Carousel demo (apps/v4/registry/new-york-v4/examples/carousel-size.tsx, MIT, © shadcn):
// same slides, options and layout on the ui Carousel (shadcn's CarouselPrevious / CarouselNext sit outside: placement="outside").
import { Card } from "@rivetjs/ui/card";
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: shadcn sizes" };

const SLIDES = Array.from({ length: 5 });

// #region demo
export function CarouselShadcnSizes() {
  return (
    <Carousel
      id="carousel-shadcn-sizes"
      aria-label="Sizes"
      align="start"
      placement="outside"
      slideCount={SLIDES.length}
      class="w-full max-w-sm md:[--rv-carousel-slide-size:50%] lg:[--rv-carousel-slide-size:33.333%]"
    >
      <Carousel.Content>
        {SLIDES.map((_, index) => (
          <Carousel.Item>
            <div class="p-1">
              <Card>
                <Card.Content class="flex aspect-square items-center justify-center p-6">
                  <span class="text-3xl font-semibold">{index + 1}</span>
                </Card.Content>
              </Card>
            </div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-shadcn-sizes-prev" variant="secondary" />
      <Carousel.Next id="carousel-shadcn-sizes-next" variant="secondary" />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CarouselShadcnSizes />
    </div>
  );
}
