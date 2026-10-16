import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Spinner: Sizes",
  summary: 'Spinner demo "Sizes".',
  tags: ["spinner"],
  status: "experimental",
  frame: { height: 120 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="spinner"]' }],
});
