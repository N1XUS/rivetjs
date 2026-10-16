// Rivet-authored Masonry demo (Rivet addition, no HeroUI counterpart): click a card to grow it to two columns; the
// relayout plays on Motion's WAAPI engine with a spring (`layoutDriver` from @rivetjs/motion/layout).
import { signal } from "@rivetjs/reactivity";
import { Icon } from "@rivetjs/kit/icon";
import { Maximize2, Minimize2 } from "lucide";
import { Masonry, masonrySizes, type Key } from "@rivetjs/ui/masonry";
import { spring } from "@rivetjs/motion";
import { layoutDriver } from "@rivetjs/motion/layout";
import bloom from "../assets/cover-bloom.jpg?image";
import dune from "../assets/cover-dune.jpg?image";
import neon from "../assets/cover-neon.jpg?image";
import cherries from "../assets/cherries.jpg?image";
import cactus from "../assets/cactus.jpg?image";
import avocado from "../assets/avocado.jpg?image";
import robot from "../assets/robot-face.jpg?image";
import tide from "../assets/cover-tide.jpg?image";

export const head = { title: "Motion: Masonry expand" };

const photos = [
  { id: "cherries", alt: "Two cherries on mint", image: cherries },
  { id: "cover-dune", alt: "Dunes", image: dune },
  { id: "robot", alt: "Knitted robot head", image: robot },
  { id: "cactus", alt: "Cactus in a terracotta pot", image: cactus },
  { id: "cover-bloom", alt: "Bloom", image: bloom },
  { id: "avocado", alt: "Avocado half on pink", image: avocado },
  { id: "cover-tide", alt: "Tide", image: tide },
  { id: "cover-neon", alt: "Neon", image: neon },
].map((p) => ({ ...p, width: p.image.width, height: p.image.height }));

const columns = { 0: 2, 520: 3 };
// srcset pick per card: the grid is `min(100vw - 48px, 704px)` wide (p-6 page padding, `maxWidth`); an expanded card spans 2 columns.
const narrow = masonrySizes({ columns, gap: 12, inset: 48, maxWidth: 704 });
const wide = masonrySizes({ columns, gap: 12, inset: 48, maxWidth: 704, span: 2 });

// #region demo
export function MotionMasonryExpand() {
  const expanded = signal<Key | null>(null);
  return (
    <Masonry
      id="masonry-expand"
      motion={layoutDriver({ type: spring, visualDuration: 0.35, bounce: 0.2 })}
      items={photos}
      columns={columns}
      gap={12}
      aria-label="Photos"
      maxWidth={704}
      class="w-full"
      itemClass="relative cursor-pointer"
      getSpan={(photo) => () => (expanded() === photo.id ? 2 : 1)}
      onAction={(key) => expanded.set(expanded() === key ? null : key)}
    >
      {(photo, state) => (
        <div class="h-full w-full" data-expanded={String(expanded() === state.key)}>
          <img
            src={photo.image.src}
            srcSet={photo.image.sources.at(-1)?.srcset}
            sizes={expanded() === state.key ? wide : narrow}
            alt={photo.alt}
            loading="lazy"
            draggable={false}
          />
          <span class="absolute end-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
            <Icon icon={expanded() === state.key ? Minimize2 : Maximize2} class="size-4" />
          </span>
        </div>
      )}
    </Masonry>
  );
}
// #endregion

export default function Demo() {
  return (
    <div class="flex min-h-dvh items-start justify-center p-6 [:where(&>*)]:max-w-full">
      <MotionMasonryExpand />
    </div>
  );
}
