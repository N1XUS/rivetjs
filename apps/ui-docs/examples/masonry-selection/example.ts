import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: Selection",
  summary:
    'selectionMode="multiple" with a two-way signal: click or Space toggles a tile, Shift extends, Ctrl+A selects all, Escape clears. Arrow keys follow the visual position.',
  tags: ["masonry", "selection", "keyboard"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: '#masonry-selection [data-key="shop-mug"]' },
    { expect: ["#masonry-selection-count", "1 selected"] },
    { attr: ['#masonry-selection [data-key="shop-mug"]', "aria-selected", "true"] },
  ],
});
