// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Infinite Scroll" example (packages/embla-carousel-docs, Miscellaneous/InfiniteScroll +
// SandboxFilesSrc/InfiniteScroll, MIT, © David Jerleke): when the last slide scrolls into view, a (mocked) request appends five
// slides, up to 20; a custom `watchSlides` re-initialises embla and carries the scroll state over to the new engine.
import type { EngineType } from "@rivetjs/cdk/carousel/engine";
import { signal } from "@rivetjs/reactivity";
import { For, Show } from "@rivetjs/runtime/dom";
import { Carousel } from "@rivetjs/ui/carousel";
import { Spinner } from "@rivetjs/ui/spinner";

export const head = { title: "Carousel: Infinite scroll" };

const mockApiCall = (minWait: number, maxWait: number, callback: () => void): void => {
  const min = Math.ceil(minWait);
  const max = Math.floor(maxWait);
  const wait = Math.floor(Math.random() * (max - min + 1)) + min;
  setTimeout(callback, wait);
};

// #region demo
export function CarouselInfiniteScroll() {
  const slides = signal([0, 1, 2, 3, 4]);
  const hasMoreToLoad = signal(true);
  const loadingMore = signal(false);
  const listenForScroll = signal(true);
  return (
    <Carousel
      id="carousel-infinite-scroll"
      aria-label="Infinite scroll"
      dragFree
      containScroll="keepSnaps"
      watchResize={false}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:70%]"
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
      <Carousel.Content>
        <For each={slides()} by={(slide) => slide}>
          {(slide) => (
            <Carousel.Item index={slide()} aria-label={() => `${slide() + 1} of ${slides().length}`}>
              <div class="flex h-48 select-none items-center justify-center rounded-3xl bg-surface-secondary text-4xl font-semibold text-foreground">
                {slide() + 1}
              </div>
            </Carousel.Item>
          )}
        </For>
        <Show when={hasMoreToLoad()}>
          <div
            id="carousel-infinite-scroll-loader"
            class="flex h-48 min-w-0 flex-[0_0_10rem] items-center justify-center ps-(--carousel-gap)"
            data-loading={loadingMore() ? "true" : undefined}
          >
            <Show when={loadingMore()}>
              <Spinner size="lg" />
            </Show>
          </div>
        </Show>
      </Carousel.Content>
      <Carousel.Previous id="carousel-infinite-scroll-prev" />
      <Carousel.Next id="carousel-infinite-scroll-next" />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselInfiniteScroll />
    </div>
  );
}
