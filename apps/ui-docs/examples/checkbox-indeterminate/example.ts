import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Indeterminate",
  summary: 'Checkbox demo "Indeterminate".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["[data-slot=checkbox]", "data-indeterminate", "true"] },
    { click: "[data-slot=checkbox-content]" },
    { attr: ["[data-slot=checkbox]", "data-selected", "true"] },
  ],
});
