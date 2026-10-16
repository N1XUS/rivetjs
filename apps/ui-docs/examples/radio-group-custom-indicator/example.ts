import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "RadioGroup: Custom Indicator",
  summary: 'RadioGroup demo "Custom Indicator".',
  tags: ["radio-group"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=radio-indicator] svg" }],
});
