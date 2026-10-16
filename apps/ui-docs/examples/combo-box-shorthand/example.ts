import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ComboBox: Shorthand",
  summary: "Rivet addition: `label` / `placeholder` / `items` render the input group, popover and list; `ComboBox.Item` adds the indicator and its text value.",
  tags: ["combo-box"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["[data-slot=combo-box] input", "Tex"] },
    { click: "[role=option][data-key=texas]" },
    { attr: ["[data-slot=combo-box] input", "value", "Texas"] },
  ],
});
