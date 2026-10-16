import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Input: Tailwind CSS",
  summary: 'Input demo "Tailwind CSS".',
  tags: ["input"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "input.input.rounded-xl" }],
});
