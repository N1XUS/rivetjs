import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NumberField: Form Example",
  summary: 'NumberField demo "Form Example".',
  tags: ["number-field"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=number-field]" }],
});
