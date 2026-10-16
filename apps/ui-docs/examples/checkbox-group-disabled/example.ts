import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: Disabled",
  summary: 'CheckboxGroup demo "Disabled".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=checkbox-group]", "data-disabled", "true"] }],
});
