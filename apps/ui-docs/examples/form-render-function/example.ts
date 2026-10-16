import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Form: Render Function",
  summary: 'Form demo "Render Function".',
  tags: ["form"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "form[data-custom=foo]" }],
});
