import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: fixed rows",
  summary: "10,000 rows with ListLayout at a fixed rowSize: only the visible window (plus overscan) is in the DOM; End scrolls to the last row.",
  tags: ["virtualizer", "list"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Server window: 240px viewport / 32px rows = rows 0..7 plus overscan; nothing far away.
    { attr: ["#rows", "role", "list"] },
    { name: ["#rows", "Rows"] },
    { matches: '#rows [data-rv-view="0"]' },
    { matches: '#rows [data-rv-view="7"]' },
    { absent: '#rows [data-rv-view="50"]' },
    { matches: '#rows .rv-Virtualizer-content:is([style*="height:320000px"], [style*="height: 320000px"])' },
    { matches: '#rows [data-rv-view="1"]:is([style*="top:32px"], [style*="top: 32px"])' },
    // The first scroll starts the engine (onScroll runs after it); End then jumps to the last window.
    { press: ["#rows", "ArrowDown"] },
    { expect: ["#rows-top", "scrollTop: 40"] },
    { click: "#rows-bottom" },
    { matches: '#rows [data-rv-view="9999"]' },
    { absent: '#rows [data-rv-view="0"]' },
    { expect: ['#rows [data-rv-view="9999"]', "Row 9999"] },
    // Wait for the end of the (smooth) keyboard scroll: 320000px content - 240px viewport.
    { expect: ["#rows-top", "scrollTop: 319760"] },
    { click: "#rows-first" },
    { matches: '#rows [data-rv-view="0"]' },
    { absent: '#rows [data-rv-view="9999"]' },
  ],
});
