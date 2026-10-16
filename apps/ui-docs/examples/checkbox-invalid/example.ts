import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Invalid",
  summary: 'Checkbox demo "Invalid".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=checkbox]", "data-invalid", "true"] }, { matches: "[data-slot=field-error]" }],
});
