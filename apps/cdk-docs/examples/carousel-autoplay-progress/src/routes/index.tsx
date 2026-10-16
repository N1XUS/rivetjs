// Port of the embla-carousel 8.6.0 "Autoplay" example (packages/embla-carousel-docs, Plugins/Autoplay + SandboxFilesSrc/Autoplay,
// MIT, © David Jerleke): Autoplay with playOnInit off, a Start / Stop button and a progress bar driven by the plugin's
// `autoplay:timerset` / `autoplay:timerstopped` events. Rivet: the button is the APG CarouselRotationControl.
import { Carousel, CarouselContainer, CarouselNext, CarouselPrevious, CarouselRotationControl, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { signal } from "@rivetjs/reactivity";
import { ChevronLeft, ChevronRight } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Autoplay with a progress bar" };

const slides = [1, 2, 3, 4, 5];

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function AutoplayProgressCarousel() {
  const showProgress = signal(false);
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel
        id="autoplay"
        aria-label="Autoplay"
        loop
        autoplay={{ playOnInit: false, delay: 3000 }}
        style={{ "--rv-carousel-slide-size": "70%" }}
        onApi={(api) => {
          const root = api.rootNode().closest('[aria-roledescription="carousel"]');
          const view = api.rootNode().ownerDocument.defaultView!;
          let animationName = "";
          api
            .on("autoplay:timerset", () => {
              const node = root?.querySelector<HTMLElement>(".progress-bar");
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
            <CarouselViewport>
              <CarouselContainer items={slides} class="-ml-4">
                {(slide: number) => (
                  <CarouselSlide class="pl-4">
                    <div class="flex h-40 select-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-4xl font-semibold text-slate-700">
                      {slide}
                    </div>
                  </CarouselSlide>
                )}
              </CarouselContainer>
            </CarouselViewport>
            <div class="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-2">
              <div class="flex gap-2">
                <CarouselPrevious id="prev" class={button}>
                  <Icon icon={ChevronLeft} size={18} />
                </CarouselPrevious>
                <CarouselNext id="next" class={button}>
                  <Icon icon={ChevronRight} size={18} />
                </CarouselNext>
              </div>
              <div id="progress" class="progress justify-self-center" data-hidden={showProgress() ? undefined : "true"}>
                <div class="progress-bar" />
              </div>
              <CarouselRotationControl
                id="play"
                startLabel="Start autoplay"
                stopLabel="Stop autoplay"
                class="h-9 min-w-16 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 data-[hovered]:bg-slate-50 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
              >
                {() => (isRotating() ? "Stop" : "Start")}
              </CarouselRotationControl>
            </div>
          </>
        )}
      </Carousel>
    </div>
  );
}
// #endregion
