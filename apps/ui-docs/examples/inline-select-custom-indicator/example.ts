import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InlineSelect: Custom Indicator",
  summary: "Children of InlineSelect.Indicator replace the up / down chevrons.",
  tags: ["inline-select"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=inline-select-indicator] svg" },
    { click: "[data-slot=inline-select-trigger]" },
    { click: "[role=option][data-key=name]" },
    { expect: [".inline-select__value", "Name"] },
  ],
});
