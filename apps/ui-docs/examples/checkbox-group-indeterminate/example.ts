import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: Indeterminate",
  summary: 'CheckboxGroup demo "Indeterminate".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=checkbox]", "data-indeterminate", "true"] },
    { click: "[data-slot=checkbox-content]" },
    { absent: "[data-slot=checkbox][data-indeterminate]" },
  ],
});
