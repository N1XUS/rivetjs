import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollShadow: Shadow Size",
  summary: 'ScrollShadow demo "Shadow Size".',
  tags: ["scroll-shadow"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="scroll-shadow"][data-scroll-shadow-size="80"]' }],
});
