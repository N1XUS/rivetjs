import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Card: With Avatar",
  summary: 'Card demo "With Avatar".',
  tags: ["card"],
  status: "experimental",
  frame: { height: 224 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="card"]' }],
});
