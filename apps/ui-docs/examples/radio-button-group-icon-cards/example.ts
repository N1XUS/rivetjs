import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioButtonGroup: Icon Cards",
  summary: "Vertical cards with a centred icon tile, for visual choices.",
  tags: ["radio-button-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=radio-button-group-item]:has(input[value=dark])" },
    { attr: ["[data-slot=radio-button-group-item]:has(input[value=dark])", "data-selected", "true"] },
  ],
});
