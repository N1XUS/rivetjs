import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InlineSelect: Shorthand",
  summary: "Rivet addition: `items` + a render function render the trigger (value, indicator), popover and list; `InlineSelect.Item` adds the indicator.",
  tags: ["inline-select"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: [".inline-select__value", "Weekly"] },
    { click: "[data-slot=inline-select-trigger]" },
    { click: "[role=option][data-key=monthly]" },
    { expect: [".inline-select__value", "Monthly"] },
  ],
});
