// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Lazy Load" example (packages/embla-carousel-docs, Miscellaneous/LazyLoad + SandboxFilesSrc/LazyLoad,
// MIT, © David Jerleke): slides seen so far (slidesInView, accumulated) render their image; the others show a spinner.
import { signal } from "@rivetjs/reactivity";
import { Show } from "@rivetjs/runtime/dom";
import { Carousel } from "@rivetjs/ui/carousel";
import { Spinner } from "@rivetjs/ui/spinner";
import bloomImage from "../assets/cover-bloom.jpg?image";
import duneImage from "../assets/cover-dune.jpg?image";
import emberImage from "../assets/cover-ember.jpg?image";
import pineImage from "../assets/cover-pine.jpg?image";
import tideImage from "../assets/cover-tide.jpg?image";

export const head = { title: "Carousel: Lazy load" };

const SLIDES = [
  { src: pineImage.src, alt: "Misty pine forest on a hillside" },
  { src: duneImage.src, alt: "Sand dune ridges in late light" },
  { src: tideImage.src, alt: "Soft teal bands like calm waves" },
  { src: bloomImage.src, alt: "Pale pink flower petals" },
  { src: emberImage.src, alt: "Warm orange glow over a plum field" },
];

// #region demo
export function CarouselLazyLoad() {
  // Slides seen so far: a loaded slide stays loaded.
  const loaded = signal<number[]>([]);
  return (
    <Carousel
      id="carousel-lazy-load"
      aria-label="Lazy load"
      tabs
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)]"
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
      <Carousel.Content>
        {SLIDES.map((slide, index) => (
          <Carousel.Item>
            <div class="relative h-64 overflow-hidden rounded-3xl bg-surface-secondary" data-loaded={loaded().includes(index) ? "true" : undefined}>
              <Show when={loaded().includes(index)} fallback={<Spinner size="lg" class="absolute inset-0 m-auto" />}>
                <img
                  src={slide.src}
                  alt={slide.alt}
                  class="block h-full w-full animate-[fade-in_0.2s_ease-in-out] select-none object-cover"
                  draggable={false}
                />
              </Show>
            </div>
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-lazy-load-prev" />
      <Carousel.Next id="carousel-lazy-load-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselLazyLoad />
    </div>
  );
}
