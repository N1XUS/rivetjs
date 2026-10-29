// Rivet-authored demo (Carousel is a Rivet addition: embla-carousel behaviour from @rivetjs/cdk/carousel, HeroUI look).
// Section "Modal Type" of HeroUI Pro's public Carousel docs; own content.
import { signal } from "@rivetjs/reactivity";
import { Button } from "@rivetjs/ui/button";
import { Carousel } from "@rivetjs/ui/carousel";
import { Modal } from "@rivetjs/ui/modal";

import bloomImage from "../assets/cover-bloom.jpg?image";
import duneImage from "../assets/cover-dune.jpg?image";
import pineImage from "../assets/cover-pine.jpg?image";
import tideImage from "../assets/cover-tide.jpg?image";

export const head = { title: "Carousel: Modal" };

const PHOTOS = [
  { image: pineImage, alt: "Misty pine forest on a hillside" },
  { image: duneImage, alt: "Sand dune ridges in late-afternoon light" },
  { image: bloomImage, alt: "Close-up of pale pink flower petals" },
  { image: tideImage, alt: "Soft teal and sand-coloured bands" },
];

// #region demo
export function CarouselModal() {
  const isOpen = signal(false);
  const start = signal(0);
  return (
    <div class="grid w-[min(28rem,100%)] grid-cols-4 gap-2">
      {PHOTOS.map((photo, index) => (
        <Button
          id={`carousel-modal-open-${index + 1}`}
          variant="ghost"
          aria-label={`Open photo ${index + 1} of ${PHOTOS.length}`}
          class="aspect-square h-auto w-full overflow-hidden rounded-2xl p-0"
          onPress={() => {
            start.set(index);
            isOpen.set(true);
          }}
        >
          <img src={photo.image.src} width={photo.image.width} height={photo.image.height} alt="" class="size-full object-cover" />
        </Button>
      ))}
      {/* The modal body is created when it opens, so the carousel starts at the photo that was pressed. */}
      <Modal.Content isOpen={isOpen} class="sm:max-w-xl">
        <Modal.CloseTrigger />
        <Modal.Header>
          <Modal.Heading>Studio photos</Modal.Heading>
        </Modal.Header>
        <Modal.Body class="px-12">
          <Carousel id="carousel-modal" aria-label="Studio photos" placement="outside" loop startIndex={start()} slideCount={PHOTOS.length}>
            <Carousel.Content>
              {PHOTOS.map((photo) => (
                <Carousel.Item>
                  <img
                    src={photo.image.src}
                    width={photo.image.width}
                    height={photo.image.height}
                    alt={photo.alt}
                    class="aspect-square w-full rounded-3xl object-cover"
                  />
                </Carousel.Item>
              ))}
            </Carousel.Content>
            <Carousel.Previous />
            <Carousel.Next />
            <Carousel.Counter />
          </Carousel>
        </Modal.Body>
      </Modal.Content>
    </div>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-center justify-center p-6 [:where(&>*)]:max-w-full">
      <CarouselModal />
    </div>
  );
}
