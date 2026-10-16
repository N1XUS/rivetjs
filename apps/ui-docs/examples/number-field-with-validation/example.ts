import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: With Validation",
  summary: 'NumberField demo "With Validation".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=number-field]" }],
});
