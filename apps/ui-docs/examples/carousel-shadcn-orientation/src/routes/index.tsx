// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the shadcn/ui "carousel-orientation" Carousel demo (apps/v4/registry/new-york-v4/examples/carousel-orientation.tsx, MIT, © shadcn):
// same slides, options and layout on the ui Carousel (shadcn's CarouselPrevious / CarouselNext sit outside: placement="outside").
import { Card } from "@rivetjs/ui/card";
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: shadcn orientation" };

const SLIDES = Array.from({ length: 5 });

// #region demo
export function CarouselShadcnOrientation() {
  return (
    <Carousel
      id="carousel-shadcn-orientation"
      aria-label="Orientation"
      align="start"
      orientation="vertical"
      placement="outside"
      slideCount={SLIDES.length}
      class="my-16 w-full max-w-xs [--carousel-gap:0.25rem] [--carousel-height:200px] md:[--rv-carousel-slide-size:50%]"
    >
      <Carousel.Content>
        {SLIDES.map((_, index) => (
          <Carousel.Item>
            <div class="p-1">
              <Card>
                <Card.Content class="flex items-center justify-center p-6">
                  <span class="text-3xl font-semibold">{index + 1}</span>
                </Card.Content>
              </Card>
            </div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-shadcn-orientation-prev" variant="secondary" />
      <Carousel.Next id="carousel-shadcn-orientation-next" variant="secondary" />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CarouselShadcnOrientation />
    </div>
  );
}
