import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Sizes",
  summary: 'Button demo "Sizes".',
  tags: ["button"],
  status: "experimental",
  frame: { height: 100 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button"]' }],
});
