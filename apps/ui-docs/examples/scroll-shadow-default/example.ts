import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollShadow: Usage",
  summary: 'ScrollShadow demo "Usage".',
  tags: ["scroll-shadow"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="scroll-shadow"]' }],
});
