import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Usage",
  summary: 'Checkbox demo "Usage".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=checkbox-content]" }, { attr: ["[data-slot=checkbox]", "data-selected", "true"] }],
});
