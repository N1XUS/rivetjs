import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Select: Shorthand",
  summary: "Rivet addition: `label` / `items` render the trigger, popover and list for you; `Select.Item` adds the indicator and its text value.",
  tags: ["select"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=select-trigger]" }, { click: "[role=option][data-key=texas]" }, { expect: ["[data-slot=select-value]", "Texas"] }],
});
