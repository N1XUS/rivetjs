import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: ListBox",
  summary:
    "A ListBox of 1,000 options inside <CollectionVirtualizer layout={ListLayout}>: the server renders the first window, keyboard focus scrolls offscreen options in.",
  tags: ["virtualizer", "listbox", "collections"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Server window: 280px viewport / 32px rows (+ overscan); the content is sized for all 1,000 options.
    { attr: ["#people", "role", "listbox"] },
    { matches: '#people [role=option][data-key="1"]' },
    { absent: '#people [role=option][data-key="100"]' },
    { attr: ['#people [role=option][data-key="1"]', "aria-setsize", "1000"] },
    { matches: '#people .rv-Virtualizer-content:is([style*="height:32000px"], [style*="height: 32000px"])' },
    // The first wheel starts the engine: the window moves.
    { wheel: ["#people", 1600] },
    { matches: '#people [role=option][data-key="51"]' },
    { absent: '#people [role=option][data-key="1"]' },
    { click: '#people [role=option][data-key="52"]' },
    { expect: ["#people-value", "Selected: 52"] },
    // Keyboard focus walks past the window edge: the options scroll in and keep focus.
    { key: "End" },
    { focused: '#people [role=option][data-key="1000"]' },
    { key: "Space" },
    { expect: ["#people-value", "Selected: 52, 1000"] },
    { key: "Home" },
    { focused: '#people [role=option][data-key="1"]' },
  ],
});
