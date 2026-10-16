import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Input: Variants",
  summary: 'Input demo "Variants".',
  tags: ["input"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "input.input--secondary" }],
});
