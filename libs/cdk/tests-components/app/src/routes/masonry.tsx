// Masonry + Bento on a resumed page. `#photos` = exact masonry (known ratios, multiple selection, action → `#action`,
// selection count → `#count`), `#tiles` = Bento dense dashboard. Nothing may boot at load: the exact layout is server CSS.
import { computed, signal } from "@rivetjs/reactivity";
import { Bento, Masonry } from "@rivetjs/cdk/masonry";
import type { Key, Selection } from "@rivetjs/cdk/collections/types";

const photos = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, aspectRatio: [1, 0.66, 1.5, 0.8, 1.25][i % 5]! }));
const tiles = [{ id: "revenue", colSpan: 2, rowSpan: 2 }, { id: "users" }, { id: "orders" }, { id: "traffic", colSpan: 2 }, { id: "errors" }];

export default function MasonryStories() {
  const selected = signal<Selection>(new Set<Key>());
  const action = signal("");
  const count = computed(() => (selected() === "all" ? "all" : String((selected() as Set<Key>).size)));
  return (
    <main>
      <p>
        Action: <span id="action">{action()}</span> Selected: <span id="count">{count()}</span>
      </p>
      <Masonry
        id="photos"
        items={photos}
        columns={3}
        gap={8}
        aria-label="Photos"
        selectionMode="multiple"
        selectedKeys={selected}
        onAction={(key) => action.set(String(key))}
        style={{ width: "600px" }}
      >
        {(photo, state) => (
          <span class="photo">
            {photo.id}
            {state.isSelected() ? " (selected)" : ""}
          </span>
        )}
      </Masonry>
      <Bento id="tiles" items={tiles} columns={3} rowHeight={80} gap={8} aria-label="Dashboard" style={{ width: "600px" }}>
        {(tile) => <strong>{tile.id}</strong>}
      </Bento>
    </main>
  );
}
