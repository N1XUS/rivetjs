// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Variable Widths" example (packages/embla-carousel-docs/src/components/Examples/Basic/VariableWidths.tsx, MIT, © David Jerleke): same options and slides.
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Variable widths" };

const SLIDES = ["60%", "40%", "30%", "90%", "35%", "55%", "85%", "50%", "35%"];

// #region demo
export function CarouselVariableWidths() {
  return (
    <Carousel id="carousel-variable-widths" aria-label="Variable widths carousel" slideCount={SLIDES.length} class="w-[min(36rem,100%)]">
      <Carousel.Content>
        {SLIDES.map((width, index) => (
          <Carousel.Item style={{ "--rv-carousel-slide-size": width }}>
            <div class="flex h-48 select-none items-center justify-center rounded-3xl bg-surface-secondary text-4xl font-semibold text-foreground">
              {index + 1}
            </div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-variable-widths-prev" />
      <Carousel.Next id="carousel-variable-widths-next" />
      <Carousel.Counter id="carousel-variable-widths-counter" />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselVariableWidths />
    </div>
  );
}
