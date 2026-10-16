import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: With Icons",
  summary: 'Button demo "With Icons".',
  tags: ["button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button"]' }],
});
