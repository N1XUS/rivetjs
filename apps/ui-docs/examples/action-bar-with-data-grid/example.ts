import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ActionBar: With Data Grid",
  summary: "A DataGrid with row selection drives the bar; Archive removes the selected rows.",
  tags: ["action-bar"],
  status: "experimental",
  frame: { height: 460 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-rv-select-all]" },
    { expect: ["#action-bar-grid-count", "5"] },
    { matches: ".action-bar[data-open=true]" },
    { click: "#action-bar-grid-archive" },
    { absent: ".action-bar[data-open]" },
  ],
});
