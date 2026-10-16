// Masonry + Bento on a resumed page (Rivet addition; behaviour `@rivetjs/cdk/masonry`): `#gallery` exact masonry with
// multiple selection (count → `#sel`), `#feed` Bento tiles (single selection, action → `#act`). Nothing boots at load.
import { computed, signal } from "@rivetjs/reactivity";
import { Bento, Masonry, type Key, type Selection } from "@rivetjs/ui/masonry";

const photos = Array.from({ length: 10 }, (_, i) => ({
  id: `ph${i}`,
  aspectRatio: [1, 0.75, 1.5, 0.8, 1.33][i % 5]!,
  tone: ["#1e3a8a", "#065f46", "#7c2d12", "#581c87", "#0f766e"][i % 5]!,
}));
const tiles = [
  { id: "t-revenue", title: "Revenue", colSpan: 2, rowSpan: 2 },
  { id: "t-users", title: "Users" },
  { id: "t-orders", title: "Orders" },
  { id: "t-traffic", title: "Traffic", colSpan: 2 },
  { id: "t-errors", title: "Errors" },
];

export default function MasonryStories() {
  const selected = signal<Selection>(new Set<Key>());
  const action = signal("");
  const count = computed(() => (selected() === "all" ? "all" : String((selected() as Set<Key>).size)));
  return (
    <main class="flex flex-col gap-8 p-6">
      <p>
        <span id="sel">{count()}</span> / <span id="act">{action()}</span>
      </p>
      <Masonry
        id="gallery"
        items={photos}
        columns={{ 0: 2, 640: 3 }}
        gap={12}
        aria-label="Gallery"
        selectionMode="multiple"
        selectedKeys={selected}
        class="max-w-[720px]"
      >
        {(p) => <div class="h-full w-full" style={{ background: p.tone }} />}
      </Masonry>
      <Bento
        id="feed"
        items={tiles}
        columns={3}
        rowHeight={96}
        gap={12}
        aria-label="Dashboard"
        selectionMode="single"
        onAction={(k) => action.set(String(k))}
        class="max-w-[720px]"
      >
        {(t) => <div class="flex h-full items-end bg-surface p-4 text-sm font-medium">{t.title}</div>}
      </Bento>
    </main>
  );
}
