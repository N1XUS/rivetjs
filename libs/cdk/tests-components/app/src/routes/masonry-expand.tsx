// Server-laid-out masonry with live item controls on a resumed page. `#gallery`: items carry `width` / `height` (the
// `?image` descriptor shape), columns + gaps per container breakpoint, so the server emits every position (nothing
// boots, no DOM mutation on resume at the same width). Clicking a card toggles `getSpan` 1 ↔ 2 columns (the first
// interaction on the page, no hydration): one incremental relayout, FLIP on the house motion (`motion` duration short
// for tests). `#justified` = justified rows from the same ratios (server CSS, rows fill the width).
import { signal } from "@rivetjs/reactivity";
import { Masonry } from "@rivetjs/cdk/masonry";
import type { Key } from "@rivetjs/cdk/collections/types";

const sizes = [
  [1200, 800],
  [800, 1200],
  [1000, 1000],
  [1600, 900],
  [900, 1350],
  [1200, 900],
  [700, 1000],
  [1500, 1000],
  [1000, 1250],
];
const photos = Array.from({ length: 18 }, (_, i) => {
  const [width, height] = sizes[i % sizes.length]!;
  return { id: `g${i}`, src: `/img-${i}.jpg`, width, height };
});

export default function MasonryExpand() {
  const expanded = signal<Key | null>(null);
  return (
    <main>
      <p>
        Expanded: <span id="expanded">{String(expanded() ?? "")}</span>
      </p>
      <Masonry
        id="gallery"
        items={photos}
        columns={{ 0: 2, 500: 3 }}
        gap={{ 0: 6, 500: 10 }}
        aria-label="Gallery"
        getSpan={(p) => () => (expanded() === p.id ? 2 : 1)}
        onAction={(key) => expanded.set(expanded() === key ? null : key)}
        motion={{ duration: 10 }}
        style={{ width: "600px" }}
      >
        {(photo) => <span class="photo">{photo.id}</span>}
      </Masonry>
      <Masonry id="justified" items={photos} layout="justified" rowHeight={120} gap={6} aria-label="Rows" style={{ width: "600px" }}>
        {(photo) => <span class="photo">{photo.id}</span>}
      </Masonry>
    </main>
  );
}
