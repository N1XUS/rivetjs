import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: Menu",
  summary:
    "A popover Menu of 1,000 actions inside <CollectionVirtualizer layout={ListLayout}>: the menu element is the scroll container, only its window of items renders.",
  tags: ["virtualizer", "menu", "collections"],
  status: "experimental",
  frame: { height: 360, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#commands-trigger" },
    { matches: '#commands [role=menuitem][data-key="1"]' },
    { absent: '#commands [role=menuitem][data-key="100"]' },
    { attr: ['#commands [role=menuitem][data-key="1"]', "aria-setsize", "1000"] },
    { wheel: ["#commands", 1600] },
    { matches: '#commands [role=menuitem][data-key="51"]' },
    { absent: '#commands [role=menuitem][data-key="1"]' },
    { click: '#commands [role=menuitem][data-key="52"]' },
    { expect: ["#commands-value", "Last action: Command 52"] },
    { absent: "#commands" },
    // Keyboard: ArrowUp opens with the last item focused (rendered on demand), Home goes back to the first.
    { press: ["#commands-trigger", "ArrowUp"] },
    { focused: '#commands [role=menuitem][data-key="1000"]' },
    { key: "Home" },
    { focused: '#commands [role=menuitem][data-key="1"]' },
    { key: "Enter" },
    { expect: ["#commands-value", "Last action: Command 1"] },
  ],
});
