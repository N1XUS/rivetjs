import { signal } from "@rivetjs/reactivity";
import { Masonry } from "@rivetjs/cdk/masonry";
import { Lightbox, LightboxCarousel, LightboxClose, LightboxNext, LightboxPrevious, LightboxToolbar, type LightboxSlide } from "@rivetjs/cdk/lightbox";
import { ChevronLeft, ChevronRight, X } from "lucide";
import { Icon } from "../components/Icon.tsx";
import avocado from "../assets/avocado.jpg?url";
import cactus from "../assets/cactus.jpg?url";
import cherries from "../assets/cherries.jpg?url";
import robotFace from "../assets/robot-face.jpg?url";
import robotProfile from "../assets/robot-profile.jpg?url";

export const head = { title: "Masonry: image mosaic + lightbox" };

const sources = [
  { name: "robot-face", src: robotFace, alt: "Knitted robot head", width: 880, height: 495 },
  { name: "cherries", src: cherries, alt: "Two cherries on mint", width: 640, height: 800 },
  { name: "avocado", src: avocado, alt: "Avocado half on pink", width: 640, height: 480 },
  { name: "cactus", src: cactus, alt: "Cactus in a terracotta pot", width: 400, height: 440 },
  { name: "robot-profile", src: robotProfile, alt: "Knitted robot, side view", width: 880, height: 495 },
];
// Twelve tiles from the five photos; `width` / `height` give each tile its aspect ratio.
const photos = Array.from({ length: 12 }, (_, i) => {
  const s = sources[(i * 3) % sources.length]!;
  return { ...s, id: `${s.name}-${Math.floor(i / sources.length)}` };
});
const slides: LightboxSlide[] = photos.map((p) => ({ src: p.src, alt: p.alt, width: p.width, height: p.height }));

// #region demo
export default function MasonryGallery() {
  const open = signal(false);
  const index = signal(0);
  return (
    <div class="m-4">
      <Masonry
        id="mosaic"
        items={photos}
        columns={{ 0: 2, 480: 3, 720: 4 }}
        gap={8}
        aria-label="Photos"
        onAction={(key) => {
          index.set(photos.findIndex((p) => p.id === key));
          open.set(true);
        }}
        itemClass="overflow-hidden rounded-xl outline-none cursor-zoom-in data-[focus-visible]:ring-2 data-[focus-visible]:ring-indigo-500 data-[focus-visible]:ring-offset-2"
      >
        {(photo) => <img src={photo.src} alt={photo.alt} class="block h-full w-full object-cover" draggable={false} />}
      </Masonry>
      <Lightbox isOpen={open} index={index} slides={slides} aria-label="Photos" overlayClass="z-50 bg-black/90" class="text-white">
        {() => (
          <>
            <LightboxCarousel />
            <LightboxToolbar class="absolute end-0 top-0 z-10 flex gap-2 p-3 [grid-area:main]">
              <LightboxClose class="inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white">
                <Icon icon={X} size={20} />
              </LightboxClose>
            </LightboxToolbar>
            <LightboxPrevious class="absolute start-3 top-1/2 z-10 -translate-y-1/2 [grid-area:main] inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
              <Icon icon={ChevronLeft} size={20} />
            </LightboxPrevious>
            <LightboxNext class="absolute end-3 top-1/2 z-10 -translate-y-1/2 [grid-area:main] inline-flex size-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-0">
              <Icon icon={ChevronRight} size={20} />
            </LightboxNext>
          </>
        )}
      </Lightbox>
    </div>
  );
}
// #endregion
