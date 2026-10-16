import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: waterfall",
  summary: "WaterfallLayout (masonry): equal-width columns, each item measured and placed in the shortest column.",
  tags: ["virtualizer", "waterfall", "masonry"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Server: every card at the estimated height (minItemSize scaled to the column width), three columns.
    { matches: '#cards [data-rv-view="3"]:is([style*="top:81px"], [style*="top: 81px"])' },
    // First scroll: cards are measured, and each one goes to the shortest column.
    { press: ["#cards", "ArrowDown"] },
    { matches: '#cards [data-rv-view="1"][style*="height: 132px"]' },
    { matches: '#cards [data-rv-view="3"][style*="top: 76px"]' },
    { matches: '#cards [data-rv-view="5"][style*="top: 100px"]' },
    // End: the far window renders (content grows as estimated cards there get measured).
    { click: "#cards-bottom" },
    { absent: '#cards [data-rv-view="0"]' },
    { matches: '#cards [data-rv-view="490"]' },
  ],
});
