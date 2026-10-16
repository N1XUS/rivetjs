import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Button: Disabled State",
  summary: 'Button demo "Disabled State".',
  tags: ["button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button"]' }],
});
