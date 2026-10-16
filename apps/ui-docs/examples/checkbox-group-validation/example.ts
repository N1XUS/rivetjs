import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: Validation",
  summary: 'CheckboxGroup demo "Validation".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button[type=submit]" }, { matches: "[data-slot=field-error]" }],
});
