// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the shadcn/ui "carousel-plugin" Carousel demo (apps/v4/registry/new-york-v4/examples/carousel-plugin.tsx, MIT, © shadcn):
// same slides, options and layout on the ui Carousel (shadcn's CarouselPrevious / CarouselNext sit outside: placement="outside").
import { Card } from "@rivetjs/ui/card";
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: shadcn plugin" };

const SLIDES = Array.from({ length: 5 });

// #region demo
export function CarouselShadcnPlugin() {
  return (
    <Carousel
      id="carousel-shadcn-plugin"
      aria-label="Autoplay"
      autoplay={{ delay: 2000, stopOnInteraction: true }}
      placement="outside"
      slideCount={SLIDES.length}
      class="w-full max-w-xs"
    >
      <Carousel.Content>
        {SLIDES.map((_, index) => (
          <Carousel.Item>
            <div class="p-1">
              <Card>
                <Card.Content class="flex aspect-square items-center justify-center p-6">
                  <span class="text-4xl font-semibold">{index + 1}</span>
                </Card.Content>
              </Card>
            </div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-shadcn-plugin-prev" variant="secondary" />
      <Carousel.Next id="carousel-shadcn-plugin-next" variant="secondary" />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CarouselShadcnPlugin />
    </div>
  );
}
