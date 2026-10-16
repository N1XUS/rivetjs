import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Card: With Images",
  summary: 'Card demo "With Images".',
  tags: ["card"],
  status: "experimental",
  frame: { height: 1440 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="card"]' }],
});
