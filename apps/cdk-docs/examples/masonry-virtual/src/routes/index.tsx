import { signal } from "@rivetjs/reactivity";
import { Masonry, type Selection } from "@rivetjs/cdk/masonry";

export const head = { title: "Masonry: 10 000 virtualized tiles" };

const HUES = [210, 160, 25, 280, 340, 45];
const tiles = Array.from({ length: 10_000 }, (_, i) => ({ id: i, aspectRatio: [1, 0.75, 1.5, 0.8, 1.25][i % 5]!, hue: HUES[(i * 7) % HUES.length]! }));

// #region demo
export default function MasonryVirtual() {
  const selected = signal<Selection>(new Set());
  return (
    <div class="m-4">
      <p class="m-0 mb-2 text-sm text-slate-600">
        {(() => {
          const s = selected();
          return s === "all" ? "All selected" : `${s.size} selected`;
        })()}
      </p>
      <Masonry
        id="many"
        items={tiles}
        columns={{ 0: 3, 600: 5 }}
        gap={6}
        virtualize
        height={400}
        aria-label="10 000 tiles"
        selectionMode="multiple"
        selectedKeys={selected}
        class="rounded-xl border border-slate-200"
        itemClass="rounded-md outline-none data-[selected]:ring-2 data-[selected]:ring-indigo-600 data-[focus-visible]:ring-2 data-[focus-visible]:ring-slate-900"
      >
        {(tile) => (
          <div class="grid h-full place-items-center rounded-md text-xs font-medium text-white" style={{ background: `hsl(${tile.hue} 60% 45%)` }}>
            {String(tile.id)}
          </div>
        )}
      </Masonry>
    </div>
  );
}
// #endregion
