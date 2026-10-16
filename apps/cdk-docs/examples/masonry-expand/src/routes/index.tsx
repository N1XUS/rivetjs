import { signal } from "@rivetjs/reactivity";
import { Masonry } from "@rivetjs/cdk/masonry";
import type { Key } from "@rivetjs/cdk/collections/types";
import { Maximize2, Minimize2 } from "lucide";
import { Icon } from "../components/Icon.tsx";
import avocado from "../assets/avocado.jpg?url";
import cactus from "../assets/cactus.jpg?url";
import cherries from "../assets/cherries.jpg?url";
import robotFace from "../assets/robot-face.jpg?url";
import robotProfile from "../assets/robot-profile.jpg?url";

export const head = { title: "Masonry: click to expand" };

const sources = [
  { name: "cherries", src: cherries, alt: "Two cherries on mint", width: 640, height: 800 },
  { name: "robot-face", src: robotFace, alt: "Knitted robot head", width: 880, height: 495 },
  { name: "cactus", src: cactus, alt: "Cactus in a terracotta pot", width: 400, height: 440 },
  { name: "avocado", src: avocado, alt: "Avocado half on pink", width: 640, height: 480 },
  { name: "robot-profile", src: robotProfile, alt: "Knitted robot, side view", width: 880, height: 495 },
];
const photos = Array.from({ length: 10 }, (_, i) => {
  const s = sources[i % sources.length]!;
  return { ...s, id: `${s.name}-${Math.floor(i / sources.length)}` };
});

// #region demo
export default function MasonryExpand() {
  const expanded = signal<Key | null>(null);
  return (
    <div class="m-4">
      <Masonry
        id="cards"
        items={photos}
        columns={{ 0: 2, 560: 3 }}
        gap={8}
        aria-label="Photos"
        // A live span: the accessor re-places only what follows the changed card.
        getSpan={(photo) => () => (expanded() === photo.id ? 2 : 1)}
        onAction={(key) => expanded.set(expanded() === key ? null : key)}
        itemClass="group relative overflow-hidden rounded-xl outline-none cursor-pointer data-[focus-visible]:ring-2 data-[focus-visible]:ring-indigo-500 data-[focus-visible]:ring-offset-2"
      >
        {(photo, state) => (
          <div class="h-full w-full" data-expanded={String(expanded() === state.key)}>
            <img src={photo.src} alt={photo.alt} class="block h-full w-full object-cover" draggable={false} />
            <span class="absolute end-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 backdrop-blur transition-opacity group-hover:opacity-100 group-data-[focus-visible]:opacity-100">
              <Icon icon={expanded() === state.key ? Minimize2 : Maximize2} size={16} />
            </span>
          </div>
        )}
      </Masonry>
    </div>
  );
}
// #endregion
