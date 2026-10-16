import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressBar: Without Label",
  summary: 'ProgressBar demo "Without Label".',
  tags: ["progress-bar"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="progress-bar"]' }],
});
