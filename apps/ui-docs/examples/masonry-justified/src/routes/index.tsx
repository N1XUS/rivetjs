// Rivet-authored Masonry demo (Rivet addition, no HeroUI counterpart): justified photo rows from `?image` descriptors.
import { Masonry } from "@rivetjs/ui/masonry";
import bloom from "../assets/cover-bloom.jpg?image";
import dune from "../assets/cover-dune.jpg?image";
import ember from "../assets/cover-ember.jpg?image";
import neon from "../assets/cover-neon.jpg?image";
import pine from "../assets/cover-pine.jpg?image";
import tide from "../assets/cover-tide.jpg?image";
import cherries from "../assets/cherries.jpg?image";
import cactus from "../assets/cactus.jpg?image";
import avocado from "../assets/avocado.jpg?image";
import robot from "../assets/robot-face.jpg?image";
import oranges from "../assets/oranges.jpg?image";
import lamp from "../assets/shop-lamp.jpg?image";

export const head = { title: "Masonry: Justified" };

// `?image` descriptors carry `width` / `height`: the default reader takes the aspect ratio from them. `maxWidth` bounds
// the width breakpoints (smaller inline CSS per item).
const photos = [
  { id: "cover-dune", alt: "Dunes", image: dune },
  { id: "cherries", alt: "Two cherries on mint", image: cherries },
  { id: "cover-bloom", alt: "Bloom", image: bloom },
  { id: "robot", alt: "Knitted robot head", image: robot },
  { id: "cactus", alt: "Cactus in a terracotta pot", image: cactus },
  { id: "oranges", alt: "Oranges", image: oranges },
  { id: "cover-tide", alt: "Tide", image: tide },
  { id: "avocado", alt: "Avocado half on pink", image: avocado },
  { id: "lamp", alt: "Desk lamp", image: lamp },
  { id: "cover-neon", alt: "Neon", image: neon },
  { id: "cover-pine", alt: "Pines", image: pine },
  { id: "cover-ember", alt: "Embers", image: ember },
].map((p) => ({ ...p, width: p.image.width, height: p.image.height }));

// #region demo
export function MasonryJustified() {
  return (
    <Masonry
      id="masonry-justified"
      items={photos}
      layout="justified"
      rowHeight={{ 0: 120, 560: 170 }}
      gap={8}
      aria-label="Photos"
      maxWidth={768}
      class="w-full"
    >
      {(photo) => <img src={photo.image.src} alt={photo.alt} loading="lazy" draggable={false} />}
    </Masonry>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 [:where(&>*)]:max-w-full">
      <MasonryJustified />
    </div>
  );
}
