import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Spinner: Usage",
  summary: 'Spinner demo "Usage".',
  tags: ["spinner"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="spinner"]' }],
});
