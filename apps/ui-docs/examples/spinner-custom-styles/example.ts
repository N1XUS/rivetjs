import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Spinner: Tailwind CSS",
  summary: 'Spinner demo "Tailwind CSS".',
  tags: ["spinner"],
  status: "experimental",
  frame: { height: 122 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="spinner"]' }],
});
