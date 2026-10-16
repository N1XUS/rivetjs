import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressBar: Colors",
  summary: 'ProgressBar demo "Colors".',
  tags: ["progress-bar"],
  status: "experimental",
  frame: { height: 312 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="progress-bar"]' }],
});
