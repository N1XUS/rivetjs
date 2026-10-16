import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: variable row heights",
  summary:
    "estimatedRowSize renders the server window at 32px rows; the browser measures each row on the first scroll, and shouldObserveItemSize re-measures a row whose content grows.",
  tags: ["virtualizer", "list", "measurement"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Server: every row at the estimate (32px), flagged as estimated by its position only.
    { matches: '#notes [data-rv-view="1"]:is([style*="top:32px"], [style*="top: 32px"])' },
    // First scroll: rows are measured. Every third row is 64px tall, so row 1 starts at 64px, row 4 at 192px.
    { press: ["#notes", "ArrowDown"] },
    { matches: '#notes [data-rv-view="1"][style*="top: 64px"]' },
    { matches: '#notes [data-rv-view="4"][style*="top: 192px"]' },
    // Growing a row's content: the ResizeObserver re-measures it and pushes the rows after it.
    { click: "#grow" },
    { attr: ["#grow", "aria-pressed", "true"] },
    { matches: '#notes [data-rv-view="2"][style*="height: 96px"]' },
    { matches: '#notes [data-rv-view="3"][style*="top: 192px"]' },
  ],
});
