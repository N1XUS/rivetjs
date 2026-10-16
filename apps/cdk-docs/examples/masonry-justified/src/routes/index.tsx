import { Masonry } from "@rivetjs/cdk/masonry";
import avocado from "../assets/avocado.jpg?url";
import cactus from "../assets/cactus.jpg?url";
import cherries from "../assets/cherries.jpg?url";
import robotFace from "../assets/robot-face.jpg?url";
import robotProfile from "../assets/robot-profile.jpg?url";

export const head = { title: "Masonry: justified rows" };

const sources = [
  { name: "robot-face", src: robotFace, alt: "Knitted robot head", width: 880, height: 495 },
  { name: "cherries", src: cherries, alt: "Two cherries on mint", width: 640, height: 800 },
  { name: "avocado", src: avocado, alt: "Avocado half on pink", width: 640, height: 480 },
  { name: "cactus", src: cactus, alt: "Cactus in a terracotta pot", width: 400, height: 440 },
  { name: "robot-profile", src: robotProfile, alt: "Knitted robot, side view", width: 880, height: 495 },
];
// Fourteen photos from the five images; `width` / `height` give each its aspect ratio (an `?image` import has both).
const photos = Array.from({ length: 14 }, (_, i) => {
  const s = sources[(i * 2) % sources.length]!;
  return { ...s, id: `${s.name}-${Math.floor(i / sources.length)}` };
});

// #region demo
export default function MasonryJustified() {
  return (
    <div class="m-4">
      <Masonry
        id="rows"
        items={photos}
        layout="justified"
        rowHeight={{ 0: 120, 640: 180 }}
        gap={6}
        maxWidth={1400}
        aria-label="Photos"
        itemClass="overflow-hidden rounded-lg outline-none data-[focus-visible]:ring-2 data-[focus-visible]:ring-indigo-500 data-[focus-visible]:ring-offset-2"
      >
        {(photo) => <img src={photo.src} alt={photo.alt} class="block h-full w-full object-cover" draggable={false} />}
      </Masonry>
    </div>
  );
}
// #endregion
