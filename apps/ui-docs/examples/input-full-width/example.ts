import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Input: Full Width",
  summary: 'Input demo "Full Width".',
  tags: ["input"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "input.input--full-width" }],
});
