import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Spinner: Speed",
  summary: 'Spinner demo "Speed".',
  tags: ["spinner"],
  status: "experimental",
  frame: { height: 104 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="spinner"]' }],
});
