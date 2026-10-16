import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Switch: Form Integration",
  summary: 'Switch demo "Form Integration".',
  tags: ["switch"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "form [data-slot=switch-group]" }],
});
