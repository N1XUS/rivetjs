// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Auto Scroll" example (packages/embla-carousel-docs, Plugins/AutoScroll + SandboxFilesSrc/AutoScroll,
// MIT, © David Jerleke): autoScroll with playOnInit off, started and stopped by the rotation control.
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Auto scroll" };

const SLIDES = [1, 2, 3, 4, 5, 6, 7, 8];

// #region demo
export function CarouselAutoScroll() {
  return (
    <Carousel
      id="carousel-auto-scroll"
      aria-label="Auto scroll"
      loop
      autoScroll={{ playOnInit: false }}
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:45%]"
    >
      {({ isRotating }) => (
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
          <Carousel.Previous id="carousel-auto-scroll-prev" />
          <Carousel.Next id="carousel-auto-scroll-next" />
          <div class="col-span-full mt-3 flex justify-center">
            <Carousel.RotationControl
              id="carousel-auto-scroll-play"
              startLabel="Start auto scroll"
              stopLabel="Stop auto scroll"
              class="w-auto min-w-16 px-4 font-semibold"
            >
              {() => (isRotating() ? "Stop" : "Start")}
            </Carousel.RotationControl>
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
      <CarouselAutoScroll />
    </div>
  );
}
