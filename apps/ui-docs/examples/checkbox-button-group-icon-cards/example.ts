import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxButtonGroup: Icon Cards",
  summary: "Vertical cards with a centred icon tile, for visual choices.",
  tags: ["checkbox-button-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=checkbox-button-group-item]:has(input[value=dark])" },
    { attr: ["[data-slot=checkbox-button-group-item]:has(input[value=dark])", "data-selected", "true"] },
  ],
});
