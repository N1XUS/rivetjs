import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: scrollToIndex and scrollToOffset",
  summary:
    'scrollToIndex(state, i) and scrollToOffset(state, px) scroll a viewport from anywhere (they start its engine on first use); behavior "smooth" animates.',
  tags: ["scrolling", "virtual scroll", "programmatic"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#to-500" },
    { expect: ["#jump-index", "First visible: 500"] },
    { matches: '#jump .row[data-index="500"]' },
    { absent: '#jump .row[data-index="0"]' },
    { click: "#to-offset" },
    { expect: ["#jump-index", "First visible: 25"] },
    { matches: '#jump .row[data-index="25"]' },
    { click: "#to-last" },
    { expect: ["#jump-index", "First visible: 994"] },
    { matches: '#jump .row[data-index="999"]' },
    { click: "#to-first-smooth" },
    { expect: ["#jump-index", "First visible: 0"] },
    { matches: '#jump .row[data-index="0"]' },
  ],
});
