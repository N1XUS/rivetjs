import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ActionBar: Usage",
  summary: "Select files in a ListBox: the bar slides up with the count and bulk actions; clear the selection to hide it.",
  tags: ["action-bar"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: ".action-bar[data-open]" },
    { click: "[role=option]:nth-child(2)" },
    { matches: ".action-bar[data-open=true] [role=toolbar]" },
    { expect: ["#action-bar-count", "1"] },
    { click: "[role=option]:nth-child(4)" },
    { expect: ["#action-bar-count", "2"] },
    { click: "[aria-label='Clear selection']" },
    { absent: ".action-bar[data-open]" },
  ],
});
