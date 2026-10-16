import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Card: Variants",
  summary: 'Card demo "Variants".',
  tags: ["card"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="card"]' }],
});
