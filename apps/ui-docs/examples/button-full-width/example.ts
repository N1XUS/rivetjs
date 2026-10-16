import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Full Width",
  summary: 'Button demo "Full Width".',
  tags: ["button"],
  status: "experimental",
  frame: { height: 148 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button"]' }],
});
