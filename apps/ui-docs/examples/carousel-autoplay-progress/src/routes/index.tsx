// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Autoplay" example (packages/embla-carousel-docs, Plugins/Autoplay + SandboxFilesSrc/Autoplay,
// MIT, © David Jerleke): playOnInit off, a Start / Stop button (the APG rotation control) and a progress bar restarted on every
// autoplay:timerset for the time until the next slide.
import { signal } from "@rivetjs/reactivity";
import { Carousel } from "@rivetjs/ui/carousel";

export const head = { title: "Carousel: Autoplay progress" };

const SLIDES = [1, 2, 3, 4, 5];

// #region demo
export function CarouselAutoplayProgress() {
  const showProgress = signal(false);
  return (
    <Carousel
      id="carousel-autoplay-progress"
      aria-label="Autoplay"
      loop
      autoplay={{ playOnInit: false, delay: 3000 }}
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:70%]"
      onApi={(api) => {
        const root = api.rootNode().closest('[aria-roledescription="carousel"]');
        const view = api.rootNode().ownerDocument.defaultView!;
        let animationName = "";
        api
          .on("autoplay:timerset", () => {
            const node = root?.querySelector<HTMLElement>(".autoplay-progress-bar");
            const timeUntilNext = api.plugins().autoplay?.timeUntilNext();
            if (!node || timeUntilNext == null) return;
            if (!animationName) animationName = view.getComputedStyle(node).animationName;
            // Restart the CSS animation for the new delay (embla's useAutoplayProgress).
            node.style.animationName = "none";
            node.style.transform = "translate3d(0,0,0)";
            view.requestAnimationFrame(() => {
              view.setTimeout(() => {
                node.style.animationName = animationName;
                node.style.animationDuration = `${timeUntilNext}ms`;
              }, 0);
            });
            showProgress.set(true);
          })
          .on("autoplay:timerstopped", () => showProgress.set(false));
      }}
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
          <Carousel.Previous id="carousel-autoplay-progress-prev" />
          <Carousel.Next id="carousel-autoplay-progress-next" />
          <div class="col-span-full mt-3 flex items-center justify-center gap-3">
            <div
              id="carousel-autoplay-progress-bar"
              class="autoplay-progress relative h-1.5 w-32 overflow-hidden rounded-full bg-default"
              data-hidden={showProgress() ? undefined : "true"}
            >
              <div class="autoplay-progress-bar absolute inset-y-0 -left-full w-full bg-accent" />
            </div>
            <Carousel.RotationControl
              id="carousel-autoplay-progress-play"
              startLabel="Start autoplay"
              stopLabel="Stop autoplay"
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
      <CarouselAutoplayProgress />
    </div>
  );
}
