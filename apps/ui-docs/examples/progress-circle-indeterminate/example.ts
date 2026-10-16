import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressCircle: Indeterminate",
  summary: 'ProgressCircle demo "Indeterminate".',
  tags: ["progress-circle"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="progress-circle"]' }],
});
