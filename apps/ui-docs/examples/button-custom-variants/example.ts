import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Adding custom variants",
  summary: 'Button demo "Adding custom variants".',
  tags: ["button"],
  status: "experimental",
  frame: { height: 100 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button"]' }],
});
