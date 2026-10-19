import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: GridList",
  summary:
    "A grid-layout GridList of 1,000 cards inside <CollectionVirtualizer layout={GridLayout}>: the server renders the first rows, arrow keys move by row and column across the window edge.",
  tags: ["virtualizer", "grid-list", "collections"],
  status: "experimental",
  frame: { height: 356, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#cards", "role", "grid"] },
    { attr: ["#cards", "aria-rowcount", "1000"] },
    { matches: '#cards [role=row][data-key="1"]' },
    { absent: '#cards [role=row][data-key="200"]' },
    // 72px rows (64 + 8): 2000px scrolls card row 29 (cards 88-90) into view.
    { wheel: ["#cards", 2000] },
    { matches: '#cards [role=row][data-key="88"]' },
    { absent: '#cards [role=row][data-key="1"]' },
    { click: '#cards [role=row][data-key="88"]' },
    { expect: ["#cards-value", "Selected: 88"] },
    // Three columns: ArrowDown moves one row (+3), ArrowRight one card.
    { key: "ArrowDown" },
    { focused: '#cards [role=row][data-key="91"]' },
    { key: "ArrowRight" },
    { focused: '#cards [role=row][data-key="92"]' },
    { key: "End" },
    { focused: '#cards [role=row][data-key="1000"]' },
    { key: "Home" },
    { focused: '#cards [role=row][data-key="1"]' },
  ],
});
