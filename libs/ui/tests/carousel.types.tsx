// Type-level suite (`tsc -p libs/ui` only): `Carousel` parts accept the cdk props (+ `class`, sizes, placement, orientation,
// control variants), `Carousel["…Props"]`, items renderer, thumbnails renderer; errors: unknown size / placement / orientation,
// embla `axis` (picked by `orientation`), bad control variant, thumbnails without a renderer.
import { signal } from "@rivetjs/reactivity";
import { Carousel } from "../src/components/carousel/index.ts";

const index = signal(0);
const images = ["a.jpg", "b.jpg"];

export const ok = () => (
  <Carousel
    aria-label="Gallery"
    size="lg"
    placement="outside"
    orientation="vertical"
    loop
    align="start"
    dragFree
    slidesToScroll={2}
    autoplay={{ delay: 3000 }}
    tabs
    onSelect={(i: number) => index.set(i)}
    onApi={(api) => void api.scrollNext()}
    class={({ isPlaying }) => (isPlaying() ? "playing" : "idle")}
  >
    <Carousel.Content items={images} class="x" viewportClass="y">
      {(src: string) => (
        <Carousel.Item class="basis-1/2">
          <img src={src} alt="" />
        </Carousel.Item>
      )}
    </Carousel.Content>
    <Carousel.Previous variant="secondary" size="sm" />
    <Carousel.Next aria-label="Forward" />
    <Carousel.RotationControl stopLabel="Pause" startLabel="Play" />
    <Carousel.Dots>{(i) => <Carousel.Dot index={i} class="dot" />}</Carousel.Dots>
    <Carousel.Thumbnails>{(i) => <img src={images[i]} alt="" />}</Carousel.Thumbnails>
    <Carousel.Counter separator=" of " class="c" />
  </Carousel>
);

export const props: Carousel["Props"] = { "aria-label": "x", size: "sm" };
export const thumbnails: Carousel["ThumbnailsProps"] = { children: (i: number) => String(i), custom: false };

export const bad = () => (
  <>
    {/* @ts-expect-error unknown size */}
    <Carousel size="xl" />
    {/* @ts-expect-error unknown placement */}
    <Carousel placement="top" />
    {/* @ts-expect-error unknown orientation */}
    <Carousel orientation="diagonal" />
    {/* @ts-expect-error `axis` is picked by `orientation` */}
    <Carousel axis="y" />
    {/* @ts-expect-error bad control variant */}
    <Carousel.Next variant="huge" />
    {/* @ts-expect-error thumbnails need a renderer */}
    <Carousel.Thumbnails />
    {/* @ts-expect-error a dot needs its snap index */}
    <Carousel.Dot />
  </>
);
