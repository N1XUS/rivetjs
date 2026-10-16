import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressCircle: Tailwind CSS",
  summary: 'ProgressCircle demo "Tailwind CSS".',
  tags: ["progress-circle"],
  status: "experimental",
  frame: { height: 112 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="progress-circle"]' }],
});
