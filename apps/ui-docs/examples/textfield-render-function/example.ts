import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TextField: Render Function",
  summary: 'TextField demo "Render Function".',
  tags: ["textfield"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=textfield]" }],
});
