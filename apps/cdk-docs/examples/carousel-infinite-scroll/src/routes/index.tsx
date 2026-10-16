// Port of the embla-carousel 8.6.0 "Infinite Scroll" example (packages/embla-carousel-docs, Miscellaneous/InfiniteScroll +
// SandboxFilesSrc/InfiniteScroll, MIT, © David Jerleke): when the last slide scrolls into view, a (mocked) request appends
// five slides, up to 20; a custom `watchSlides` re-initialises embla and carries the scroll state over to the new engine,
// so the momentum of a drag-free flick survives the reload.
import { Carousel, CarouselContainer, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import type { EngineType } from "@rivetjs/cdk/carousel/engine";
import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Infinite scroll" };

const mockApiCall = (minWait: number, maxWait: number, callback: () => void): void => {
  const min = Math.ceil(minWait);
  const max = Math.floor(maxWait);
  const wait = Math.floor(Math.random() * (max - min + 1)) + min;
  setTimeout(callback, wait);
};

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function InfiniteScrollCarousel() {
  const slides = signal([0, 1, 2, 3, 4]);
  const hasMoreToLoad = signal(true);
  const loadingMore = signal(false);
  const listenForScroll = signal(true);
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel
        id="infinite"
        aria-label="Infinite scroll"
        dragFree
        containScroll="keepSnaps"
        watchResize={false}
        watchSlides={(emblaApi) => {
          const reloadEmbla = (): void => {
            const oldEngine = emblaApi.internalEngine();
            emblaApi.reInit();
            const newEngine = emblaApi.internalEngine();
            const copyEngineModules: (keyof EngineType)[] = ["scrollBody", "location", "offsetLocation", "previousLocation", "target"];
            copyEngineModules.forEach((engineModule) => {
              Object.assign(newEngine[engineModule], oldEngine[engineModule]);
            });
            newEngine.translate.to(oldEngine.location.get());
            const { index } = newEngine.scrollTarget.byDistance(0, false);
            newEngine.index.set(index);
            newEngine.animation.start();
            loadingMore.set(false);
            listenForScroll.set(true);
          };
          const reloadAfterPointerUp = (): void => {
            emblaApi.off("pointerUp", reloadAfterPointerUp);
            reloadEmbla();
          };
          const engine = emblaApi.internalEngine();
          if (hasMoreToLoad() && engine.dragHandler.pointerDown()) {
            const boundsActive = engine.limit.reachedMax(engine.target.get());
            engine.scrollBounds.toggleActive(boundsActive);
            emblaApi.on("pointerUp", reloadAfterPointerUp);
          } else {
            reloadEmbla();
          }
          return false;
        }}
        onApi={(api) => {
          const onScroll = (): void => {
            if (!listenForScroll()) return;
            const lastSlide = api.slideNodes().length - 1;
            const lastSlideInView = api.slidesInView().includes(lastSlide);
            const loadMore = !loadingMore() && lastSlideInView;
            if (loadMore) {
              listenForScroll.set(false);
              mockApiCall(1000, 2000, () => {
                if (slides().length === 20) {
                  hasMoreToLoad.set(false);
                  api.off("scroll", onScroll);
                  return;
                }
                slides.set(Array.from(Array(slides().length + 5).keys()));
              });
            }
            loadingMore.set(loadingMore() || lastSlideInView);
          };
          api.on("scroll", onScroll);
          const view = api.rootNode().ownerDocument.defaultView;
          const onResize = () => api.reInit();
          view?.addEventListener("resize", onResize);
          api.on("destroy", () => view?.removeEventListener("resize", onResize));
        }}
      >
        <CarouselViewport>
          <CarouselContainer class="-ml-4">
            <For each={slides()} by={(slide) => slide}>
              {(slide) => (
                <CarouselSlide index={slide()} aria-label={() => `${slide() + 1} of ${slides().length}`} class="pl-4">
                  <div class="flex h-40 select-none items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-4xl font-semibold text-slate-700">
                    {slide() + 1}
                  </div>
                </CarouselSlide>
              )}
            </For>
            <Show when={hasMoreToLoad()}>
              <div
                id="loader"
                class="relative ml-4 flex h-40 min-w-0 flex-[0_0_15rem] items-center justify-center"
                data-loading={loadingMore() ? "true" : undefined}
              >
                <Show when={loadingMore()}>
                  <Icon icon={LoaderCircle} size={40} class="animate-spin text-slate-400" />
                </Show>
              </div>
            </Show>
          </CarouselContainer>
        </CarouselViewport>
        <div class="mt-4 flex gap-2">
          <CarouselPrevious id="prev" class={button}>
            <Icon icon={ChevronLeft} size={18} />
          </CarouselPrevious>
          <CarouselNext id="next" class={button}>
            <Icon icon={ChevronRight} size={18} />
          </CarouselNext>
        </div>
      </Carousel>
    </div>
  );
}
// #endregion
