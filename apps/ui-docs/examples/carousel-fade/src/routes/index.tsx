// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Port of the embla-carousel 8.6.0 "Fade" example (packages/embla-carousel-docs, Plugins/Fade + SandboxFilesSrc/Fade, MIT, © David Jerleke).
// The Fade plugin stacks the slides and cross-fades them instead of scrolling.
import { Carousel } from "@rivetjs/ui/carousel";
import Fade from "@rivetjs/cdk/carousel/fade";
import bloomImage from "../assets/cover-bloom.jpg?image";
import duneImage from "../assets/cover-dune.jpg?image";
import emberImage from "../assets/cover-ember.jpg?image";
import pineImage from "../assets/cover-pine.jpg?image";
import tideImage from "../assets/cover-tide.jpg?image";

export const head = { title: "Carousel: Fade" };

const SLIDES = [
  { src: pineImage.src, alt: "Misty pine forest on a hillside" },
  { src: duneImage.src, alt: "Sand dune ridges in late light" },
  { src: tideImage.src, alt: "Soft teal bands like calm waves" },
  { src: bloomImage.src, alt: "Pale pink flower petals" },
  { src: emberImage.src, alt: "Warm orange glow over a plum field" },
];

// #region demo
export function CarouselFade() {
  return (
    <Carousel
      id="carousel-fade"
      aria-label="Fade carousel"
      loop
      duration={30}
      tabs
      slideCount={SLIDES.length}
      class="w-[min(36rem,100%)]"
      plugins={() => [Fade()]}
    >
      <Carousel.Content>
        {SLIDES.map((slide) => (
          <Carousel.Item>
            <img src={slide.src} alt={slide.alt} class="block h-64 w-full select-none rounded-3xl object-cover" draggable={false} />
          </Carousel.Item>
        ))}
      </Carousel.Content>
      <Carousel.Previous id="carousel-fade-prev" />
      <Carousel.Next id="carousel-fade-next" />
      <Carousel.Dots />
    </Carousel>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselFade />
    </div>
  );
}
