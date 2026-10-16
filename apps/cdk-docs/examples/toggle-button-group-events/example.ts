import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup events and DOM attributes",
  summary: "onSelectionChange on the group, onPress / onChange-free buttons, plus global DOM events and data-* forwarded to the group element.",
  tags: ["toggle-button-group", "events", "dom-events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#filters", "data-analytics", "filters"] },
    { hover: "#filters" },
    { expect: ["#filters-log", "group pointerenter"] },
    { click: "#filters button:nth-child(1)" },
    { expect: ["#filters-log", "selection: open"] },
    { expect: ["#filters-log", "press open (mouse)"] },
    { press: ["#filters button:nth-child(2)", "Enter"] },
    { expect: ["#filters-log", "selection: open,closed"] },
  ],
});
