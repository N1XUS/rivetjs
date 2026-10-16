// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the shadcn/ui "carousel-api" Carousel demo (apps/v4/registry/new-york-v4/examples/carousel-api.tsx, MIT, © shadcn):
// same slides, options and layout on the ui Carousel (shadcn's CarouselPrevious / CarouselNext sit outside: placement="outside").
import { Card } from "@rivetjs/ui/card";
import { Carousel } from "@rivetjs/ui/carousel";
import { signal } from "@rivetjs/reactivity";

export const head = { title: "Carousel: shadcn API" };

const SLIDES = Array.from({ length: 5 });

// #region demo
export function CarouselShadcnApi() {
  const current = signal(0);
  const count = signal(0);
  return (
    <div class="w-full max-w-xs">
      <Carousel
        id="carousel-shadcn-api"
        aria-label="API"
        onApi={(api) => {
          count.set(api.scrollSnapList().length);
          current.set(api.selectedScrollSnap() + 1);
          api.on("select", () => current.set(api.selectedScrollSnap() + 1));
        }}
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
        <Carousel.Previous id="carousel-shadcn-api-prev" variant="secondary" />
        <Carousel.Next id="carousel-shadcn-api-next" variant="secondary" />
      </Carousel>
      <div id="carousel-shadcn-api-status" class="py-2 text-center text-sm text-muted">
        Slide {current()} of {count()}
      </div>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CarouselShadcnApi />
    </div>
  );
}
