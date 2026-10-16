import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollShadow: With Card",
  summary: 'ScrollShadow demo "With Card".',
  tags: ["scroll-shadow"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="scroll-shadow"]' }],
});
