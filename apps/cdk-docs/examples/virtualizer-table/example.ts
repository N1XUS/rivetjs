import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: Table",
  summary: "A Table of 1,000 rows inside <CollectionVirtualizer layout={TableLayout}>: div rows and cells, a sticky header, only the visible rows in the DOM.",
  tags: ["virtualizer", "table", "collections"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Server window: the header and the first rows (32px each) of a 280px viewport.
    { attr: ["#staff", "role", "grid"] },
    { matches: "#staff [role=columnheader]" },
    { matches: '#staff [role=row][data-key="1"]' },
    { absent: '#staff [role=row][data-key="100"]' },
    { attr: ['#staff [role=row][data-key="1"]', "aria-rowindex", "2"] },
    // The first wheel starts the engine; rows rendered in the browser get their cells.
    { wheel: ["#staff", 1600] },
    { matches: '#staff [role=row][data-key="51"] [role=gridcell]' },
    { absent: '#staff [role=row][data-key="1"]' },
    { matches: "#staff [role=columnheader]" },
    { click: '#staff [role=row][data-key="52"] [role=rowheader]' },
    { expect: ["#staff-value", "Selected: 52"] },
    { key: "ArrowDown" },
    { focused: '#staff [data-key="53.$.0"]' },
  ],
});
