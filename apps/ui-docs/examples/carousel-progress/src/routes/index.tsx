// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Progress" example (packages/embla-carousel-docs, Miscellaneous/Progress + SandboxFilesSrc/Progress,
// MIT, © David Jerleke): a bar translated by embla's scroll progress (dragFree, 65% slides).
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Scroll progress" };

const SLIDES = [1, 2, 3, 4, 5];

// #region demo
export function CarouselProgress() {
  return (
    <Carousel
      id="carousel-progress"
      aria-label="Scroll progress"
      dragFree
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:65%]"
    >
      {({ state }) => (
        <>
          <Carousel.Content>
            {SLIDES.map((slide) => (
              <Carousel.Item>
                <div class="flex h-48 select-none items-center justify-center rounded-3xl bg-surface-secondary text-4xl font-semibold text-foreground">
                  {slide}
                </div>
              </Carousel.Item>
            ))}
          </Carousel.Content>
          <Carousel.Previous id="carousel-progress-prev" />
          <Carousel.Next id="carousel-progress-next" />
          <div class="col-span-full mt-4 flex justify-center">
            <div class="relative h-1.5 w-52 max-w-[90%] overflow-hidden rounded-full bg-default">
              <div
                id="carousel-progress-bar"
                class="absolute inset-y-0 -left-full w-full bg-accent"
                style={{ transform: `translate3d(${Math.max(0, Math.min(1, state.scrollProgress())) * 100}%,0px,0px)` }}
              />
            </div>
          </div>
        </>
      )}
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselProgress />
    </div>
  );
}
