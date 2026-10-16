import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Checkbox: Form Integration",
  summary: 'Checkbox demo "Form Integration".',
  tags: ["checkbox"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "form [data-slot=checkbox]" }],
});
