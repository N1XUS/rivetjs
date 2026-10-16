// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Class Names" example (packages/embla-carousel-docs, Plugins/ClassNames + SandboxFilesSrc/ClassNames, MIT, © David Jerleke).
// The ClassNames plugin toggles is-snapped; CSS dims the slides that are not snapped (data-snapped does the same without it).
import { Carousel } from "@rivetjs/ui/carousel";
import ClassNames from "@rivetjs/cdk/carousel/class-names";
import bloomImage from "../assets/cover-bloom.jpg?image";
import duneImage from "../assets/cover-dune.jpg?image";
import emberImage from "../assets/cover-ember.jpg?image";
import pineImage from "../assets/cover-pine.jpg?image";
import tideImage from "../assets/cover-tide.jpg?image";

export const head = { title: "Carousel: Class names" };

const SLIDES = [
  { src: pineImage.src, alt: "Misty pine forest on a hillside" },
  { src: duneImage.src, alt: "Sand dune ridges in late light" },
  { src: tideImage.src, alt: "Soft teal bands like calm waves" },
  { src: bloomImage.src, alt: "Pale pink flower petals" },
  { src: emberImage.src, alt: "Warm orange glow over a plum field" },
];

// #region demo
export function CarouselClassNames() {
  return (
    <Carousel
      id="carousel-class-names"
      aria-label="Class names carousel"
      tabs
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)] [--rv-carousel-slide-size:70%]"
      plugins={() => [ClassNames()]}
    >
      <Carousel.Content>
        {SLIDES.map((slide) => (
          <Carousel.Item class="slide">
            <img src={slide.src} alt={slide.alt} class="block h-64 w-full select-none rounded-3xl object-cover" draggable={false} />
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-class-names-prev" />
      <Carousel.Next id="carousel-class-names-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselClassNames />
    </div>
  );
}
