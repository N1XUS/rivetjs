import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: programmatic scroll and persisted keys",
  summary:
    "Buttons set the scroller's scrollTop (the scroll event drives the engine); persistedKeys keep row 0 rendered, and the last focused row stays rendered while out of view.",
  tags: ["virtualizer", "scroll", "focus"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // A first small scroll starts the engine (see the page's known limitations).
    { press: ["#log", "ArrowDown"] },
    { expect: ["#log-top", "scrollTop: 40"] },
    // Focus a row: the virtualizer remembers it as the focused view.
    { click: '#log [data-rv-view="3"] button' },
    { focused: '#log [data-rv-view="3"] button' },
    { click: "#to-500" },
    { matches: '#log [data-rv-view="500"]' },
    { expect: ["#log-top", "scrollTop: 16000"] },
    { absent: '#log [data-rv-view="1"]' },
    // Persisted: row 0 (persistedKeys) and row 3 (the focused view) stay in the DOM, at their own positions.
    { matches: '#log [data-rv-view="0"]' },
    { matches: '#log [data-rv-view="3"][style*="top: 96px"]' },
    { click: "#to-end" },
    { matches: '#log [data-rv-view="4999"]' },
    { matches: '#log [data-rv-view="3"]' },
    { click: "#to-top" },
    { matches: '#log [data-rv-view="1"]' },
    { absent: '#log [data-rv-view="4999"]' },
    { expect: ["#log-top", "scrollTop: 0"] },
  ],
});
