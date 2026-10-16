import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField with plain CSS",
  summary:
    "styles.css targets .rv-NumberField, .rv-Group, .rv-Input and the slotted .rv-Button parts with data-disabled / data-invalid / data-focus-within state; one field is required.",
  tags: ["number-field", "css", "styling", "validation"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#quantity-field > div", "class", "rv-NumberField"] },
    { attr: ["#quantity", "value", "1"] },
    { click: "#quantity-field [slot=increment]" },
    { attr: ["#quantity", "value", "2"] },
    { attr: ["#seats-field > div", "data-disabled", "true"] },
    { attr: ["#seats", "disabled", ""] },
  ],
});
