import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: With Chevrons",
  summary: 'NumberField demo "With Chevrons".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=number-field-increment-button] svg" }],
});
