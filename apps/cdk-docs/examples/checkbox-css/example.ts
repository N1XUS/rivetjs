import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox with plain CSS",
  summary:
    "A plain stylesheet for .rv-CheckboxButton and .rv-Checkbox: the label's data-selected, data-indeterminate, data-invalid, data-disabled and data-focus-visible.",
  tags: ["checkbox", "css", "styling"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: ".rv-CheckboxField > label.rv-CheckboxButton:has(#css-cb)" },
    { click: "label:has(#css-cb)" },
    { matches: 'label.rv-CheckboxButton[data-selected="true"]:has(#css-cb)' },
    { matches: 'label.rv-Checkbox[data-disabled="true"]:has(#css-legacy)' },
  ],
});
