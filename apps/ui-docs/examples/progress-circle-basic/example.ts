import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressCircle: Usage",
  summary: 'ProgressCircle demo "Usage".',
  tags: ["progress-circle"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="progress-circle"]' }],
});
