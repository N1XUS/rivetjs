import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CheckboxGroup: With Custom Indicator",
  summary: 'CheckboxGroup demo "With Custom Indicator".',
  tags: ["checkbox-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=checkbox-content]" }, { matches: "[data-slot=checkbox-indicator] svg" }],
});
