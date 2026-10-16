import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Disabled, read-only and invalid Checkbox",
  summary: "isDisabled (not focusable, never changes), isReadOnly (focusable, keeps its value) and isInvalid as an accessor of a signal.",
  tags: ["checkbox", "disabled", "read-only"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#cb-off", "disabled", ""] },
    { matches: "label[data-disabled]:has(#cb-off)" },
    { attr: ["#cb-ro", "aria-readonly", "true"] },
    { matches: "label[data-readonly]:has(#cb-ro)" },
    { click: "label:has(#cb-ro)" },
    { matches: "#cb-ro:checked" },
    { attr: ["#cb-bad", "aria-invalid", "true"] },
    { matches: ".rv-CheckboxField[data-invalid]:has(#cb-bad)" },
    { click: "label:has(#cb-bad)" },
    { matches: "#cb-bad:checked" },
    { attr: ["#cb-bad", "aria-invalid", null] },
  ],
});
