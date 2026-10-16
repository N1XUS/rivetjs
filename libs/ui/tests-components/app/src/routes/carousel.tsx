// Carousel on a resumed page (Rivet addition on `@rivetjs/cdk/carousel`): `#ca-basic` five slides (tabbed: dots + counter,
// `onSelect` → `#ca-selected`); `#ca-auto` autoplay (delay 1500 ms, loop) with the rotation control, `onSelect` →
// `#ca-auto-selected`; `#ca-thumbs` thumbnails + outside controls. No carousel engine before the first interaction
// on `#ca-basic` / `#ca-thumbs` (autoplay starts `#ca-auto` when visible).
import { signal } from "@rivetjs/reactivity";
import { Carousel } from "@rivetjs/ui/carousel";

const SLIDES = ["One", "Two", "Three", "Four", "Five"];

export default function CarouselStories() {
  const selected = signal(0);
  const autoSelected = signal(0);
  return (
    <section class="flex flex-col gap-10 p-10">
      <Carousel id="ca-basic" aria-label="Basic" tabs slideCount={5} class="w-80" onSelect={(index) => selected.set(index)}>
        <Carousel.Content>
          {SLIDES.map((name) => (
            <Carousel.Item>
              <div class="flex h-40 items-center justify-center rounded-3xl bg-surface-secondary text-2xl font-semibold">{name}</div>
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Previous id="ca-prev" />
        <Carousel.Next id="ca-next" />
        <Carousel.Dots />
        <Carousel.Counter id="ca-counter" />
      </Carousel>
      <output id="ca-selected">{String(selected())}</output>

      <Carousel
        id="ca-auto"
        aria-label="Autoplay"
        tabs
        loop
        slideCount={3}
        autoplay={{ delay: 1500 }}
        class="w-80"
        onSelect={(index) => autoSelected.set(index)}
      >
        <Carousel.Content>
          {SLIDES.slice(0, 3).map((name) => (
            <Carousel.Item>
              <div class="flex h-40 items-center justify-center rounded-3xl bg-accent-soft text-2xl font-semibold">{name}</div>
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.RotationControl id="ca-rotation" />
        <Carousel.Dots />
      </Carousel>
      <output id="ca-auto-selected">{String(autoSelected())}</output>

      <Carousel id="ca-thumbs" aria-label="Thumbnails" tabs placement="outside" slideCount={5} class="w-96">
        <Carousel.Content>
          {SLIDES.map((name) => (
            <Carousel.Item>
              <div class="flex h-40 items-center justify-center rounded-3xl bg-default text-2xl font-semibold">{name}</div>
            </Carousel.Item>
          ))}
        </Carousel.Content>
        <Carousel.Previous id="ca-thumbs-prev" />
        <Carousel.Next id="ca-thumbs-next" />
        <Carousel.Thumbnails>{(index) => <span class="flex size-full items-center justify-center text-xs">{SLIDES[index]}</span>}</Carousel.Thumbnails>
      </Carousel>
    </section>
  );
}
