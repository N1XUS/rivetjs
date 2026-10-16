import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: Usage",
  summary: 'CheckboxGroup demo "Usage".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=checkbox-content]" }, { attr: ["[data-slot=checkbox]", "data-selected", "true"] }],
});
