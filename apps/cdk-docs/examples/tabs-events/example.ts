import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs events",
  summary: "onSelectionChange runs on every selection, from a press or a key, and again when the selected tab is pressed.",
  tags: ["aria", "tabs", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#log", "onSelectionChange: none"] },
    { click: "#views-tab-board" },
    { expect: ["#log", "onSelectionChange: board"] },
    { click: "#views-tab-board" },
    { expect: ["#log", "onSelectionChange: board, board"] },
    { key: "ArrowRight" },
    { expect: ["#log", "onSelectionChange: board, board, calendar"] },
    { key: "Home" },
    { expect: ["#log", "onSelectionChange: board, board, calendar, list"] },
  ],
});
