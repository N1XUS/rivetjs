import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Card: Horizontal Layout",
  summary: 'Card demo "Horizontal Layout".',
  tags: ["card"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="card"]' }],
});
