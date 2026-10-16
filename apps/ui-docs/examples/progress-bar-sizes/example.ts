import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressBar: Sizes",
  summary: 'ProgressBar demo "Sizes".',
  tags: ["progress-bar"],
  status: "experimental",
  frame: { height: 200 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="progress-bar"]' }],
});
