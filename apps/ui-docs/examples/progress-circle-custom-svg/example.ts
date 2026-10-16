import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressCircle: Custom SVG Props",
  summary: 'ProgressCircle demo "Custom SVG Props".',
  tags: ["progress-circle"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="progress-circle"]' }],
});
