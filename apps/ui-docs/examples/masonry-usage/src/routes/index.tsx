// Rivet-authored Masonry demo (Rivet addition, no HeroUI counterpart): a photo wall from the shared example images.
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

export const head = { title: "Masonry: Usage" };

const photos = [
  { id: "cover-dune", alt: "Dunes", image: dune },
  { id: "cherries", alt: "Two cherries on mint", image: cherries },
  { id: "cover-bloom", alt: "Bloom", image: bloom },
  { id: "robot", alt: "Knitted robot head", image: robot },
  { id: "cactus", alt: "Cactus in a terracotta pot", image: cactus },
  { id: "cover-tide", alt: "Tide", image: tide },
  { id: "avocado", alt: "Avocado half on pink", image: avocado },
  { id: "cover-neon", alt: "Neon", image: neon },
  { id: "cover-pine", alt: "Pines", image: pine },
  { id: "cover-ember", alt: "Embers", image: ember },
].map((p) => ({ ...p, aspectRatio: p.image.width / p.image.height }));

// #region demo
export function MasonryUsage() {
  return (
    <Masonry id="masonry-usage" items={photos} columns={{ 0: 2, 520: 3 }} gap={12} aria-label="Photos" class="w-[min(44rem,100%)]">
      {(photo) => <img src={photo.image.src} alt={photo.alt} loading="lazy" draggable={false} />}
    </Masonry>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 [:where(&>*)]:max-w-full">
      <MasonryUsage />
    </div>
  );
}
