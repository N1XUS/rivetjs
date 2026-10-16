import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Overlay transitions",
  summary:
    "A Popover with CSS transitions and a menu with CSS animations, both on the entering: and exiting: variants; each stays mounted until its exit ends.",
  tags: ["styling", "tailwind", "transition", "popover", "menu"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { absent: "#info" },
    { click: "#info-trigger" },
    { matches: "#info[role=dialog]" },
    // Settled open: the enter phase attribute is gone.
    { matches: "[data-rv-overlay]:has(#info):not([data-entering])" },
    { key: "Escape" },
    { absent: "#info" },
    { focused: "#info-trigger" },
    // Second open renders the content again (not only the heading).
    { click: "#info-trigger" },
    { matches: "#info[role=dialog]" },
    { expect: ["#info p", "Orders ship within two days."] },
    { key: "Escape" },
    { absent: "#info" },
    { press: ["#actions-trigger", "ArrowDown"] },
    { matches: ".actions-popover" },
    { attr: [".actions-popover", "data-entering", null] },
    { focused: '[data-key="rename"]' },
    { key: "ArrowDown" },
    { key: "Enter" },
    { expect: ["#value", "Last action: duplicate"] },
    { absent: ".actions-popover" },
    { focused: "#actions-trigger" },
  ],
});
