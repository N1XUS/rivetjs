// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Auto Height" example (packages/embla-carousel-docs, Plugins/AutoHeight + SandboxFilesSrc/AutoHeight, MIT, © David Jerleke).
// The AutoHeight plugin sets the track height to the tallest slide of the selected snap.
import { Carousel } from "@rivetjs/ui/carousel";
import AutoHeight from "@rivetjs/cdk/carousel/auto-height";

export const head = { title: "Carousel: Auto height" };

const SLIDES = [1, 2, 3, 4, 5];
// Slide heights of the upstream example: 19rem, +4rem, -2rem, +2rem, 19rem (scaled down).
const HEIGHTS = ["h-40", "h-56", "h-32", "h-48", "h-40"];

// #region demo
export function CarouselAutoHeight() {
  return (
    <Carousel
      id="carousel-auto-height"
      aria-label="Auto height carousel"
      tabs
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)]"
      plugins={() => [AutoHeight()]}
    >
      <Carousel.Content class="items-start transition-[height] duration-200 motion-reduce:transition-none">
        {SLIDES.map((slide, index) => (
          <Carousel.Item>
            <div
              class={`flex ${HEIGHTS[index]} select-none items-center justify-center rounded-3xl bg-surface-secondary text-4xl font-semibold text-foreground`}
            >
              {slide}
            </div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-auto-height-prev" />
      <Carousel.Next id="carousel-auto-height-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselAutoHeight />
    </div>
  );
}
