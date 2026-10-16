// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the shadcn/ui "carousel-rtl" Carousel demo (apps/v4/registry/new-york-v4/examples/carousel-rtl.tsx, MIT, © shadcn):
// same slides, options and layout on the ui Carousel (shadcn's CarouselPrevious / CarouselNext sit outside: placement="outside").
import { Card } from "@rivetjs/ui/card";
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: shadcn RTL" };

const SLIDES = Array.from({ length: 5 });

// #region demo
export function CarouselShadcnRtl() {
  return (
    <div id="carousel-shadcn-rtl-wrapper" dir="rtl" lang="ar" class="w-full max-w-[12rem] sm:max-w-xs">
      <Carousel id="carousel-shadcn-rtl" aria-label="شرائح" direction="rtl" placement="outside" slideCount={SLIDES.length} class="w-full">
        <Carousel.Content>
          {SLIDES.map((_, index) => (
            <Carousel.Item>
              <div class="p-1">
                <Card>
                  <Card.Content class="flex aspect-square items-center justify-center p-6">
                    <span class="text-4xl font-semibold">{(index + 1).toLocaleString("ar-EG")}</span>
                  </Card.Content>
                </Card>
              </div>
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Previous id="carousel-shadcn-rtl-prev" variant="secondary" />
        <Carousel.Next id="carousel-shadcn-rtl-next" variant="secondary" />
      </Carousel>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6">
      <CarouselShadcnRtl />
    </div>
  );
}
