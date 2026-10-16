import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: Validation",
  summary: 'ColorField demo "Validation".',
  tags: ["color-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-field]", "data-invalid", "true"] }, { matches: "[data-slot=field-error]" }],
});
