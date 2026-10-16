import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Spinner: Colors",
  summary: 'Spinner demo "Colors".',
  tags: ["spinner"],
  status: "experimental",
  frame: { height: 104 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="spinner"]' }],
});
