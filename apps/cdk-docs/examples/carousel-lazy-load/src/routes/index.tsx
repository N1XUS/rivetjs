// Port of the embla-carousel 8.6.0 "Lazy Load" example (packages/embla-carousel-docs, Miscellaneous/LazyLoad + SandboxFilesSrc/LazyLoad,
// MIT, © David Jerleke): slides load their content the first time embla reports them in view (`slidesInView`); a spinner
// shows until then. Rivet: gradient tiles stand in for the upstream photos, so "loading" = rendering the tile.
import { Carousel, CarouselContainer, CarouselDot, CarouselDots, CarouselNext, CarouselPrevious, CarouselSlide, CarouselViewport } from "@rivetjs/cdk/carousel";
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide";
import { Icon } from "../components/Icon.tsx";

export const head = { title: "Lazy load" };

const slides = [
  "from-indigo-300 to-cyan-200",
  "from-rose-300 to-amber-200",
  "from-emerald-300 to-lime-200",
  "from-sky-300 to-violet-200",
  "from-orange-300 to-pink-200",
];

const button =
  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 shadow-sm data-[hovered]:bg-slate-50 data-[disabled]:opacity-40 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200";

// #region demo
export default function LazyLoadCarousel() {
  // Slides seen so far (embla `slidesInView`, accumulated): a loaded slide stays loaded.
  const loaded = signal<number[]>([]);
  return (
    <div class="m-4 w-[min(36rem,calc(100%-2rem))]">
      <Carousel
        id="lazy"
        aria-label="Lazy load"
        tabs
        onApi={(api) => {
          const update = () => {
            const seen = loaded();
            if (seen.length === api.slideNodes().length) return void api.off("slidesInView", update);
            const inView = api.slidesInView().filter((index) => !seen.includes(index));
            if (inView.length) loaded.set(seen.concat(inView));
          };
          update();
          api.on("slidesInView", update).on("reInit", update);
        }}
      >
        <CarouselViewport>
          <CarouselContainer items={slides} class="-ml-4">
            {(colors: string, index) => (
              <CarouselSlide class="pl-4">
                <div class="relative h-48 rounded-xl border border-slate-200" data-loaded={loaded().includes(index()) ? "true" : undefined}>
                  <Show
                    when={loaded().includes(index())}
                    fallback={<Icon icon={LoaderCircle} size={40} class="absolute inset-0 m-auto animate-spin text-slate-400" />}
                  >
                    <div
                      class={`flex h-full animate-[fade-in_0.2s_ease-in-out] items-center justify-center rounded-xl bg-gradient-to-br ${colors} text-4xl font-semibold text-slate-700`}
                    >
                      {index() + 1}
                    </div>
                  </Show>
                </div>
              </CarouselSlide>
            )}
          </CarouselContainer>
        </CarouselViewport>
        <div class="mt-4 flex items-center justify-between gap-2">
          <div class="flex gap-2">
            <CarouselPrevious id="prev" class={button}>
              <Icon icon={ChevronLeft} size={18} />
            </CarouselPrevious>
            <CarouselNext id="next" class={button}>
              <Icon icon={ChevronRight} size={18} />
            </CarouselNext>
          </div>
          <CarouselDots class="flex gap-2">
            {(index) => (
              <CarouselDot
                index={index}
                class="h-2.5 w-2.5 rounded-full bg-slate-300 data-[selected]:bg-indigo-600 data-[focus-visible]:ring-4 data-[focus-visible]:ring-indigo-200"
              />
            )}
          </CarouselDots>
        </div>
      </Carousel>
    </div>
  );
}
// #endregion
