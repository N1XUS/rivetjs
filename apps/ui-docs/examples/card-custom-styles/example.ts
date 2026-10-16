import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Card: Tailwind CSS",
  summary: 'Card demo "Tailwind CSS".',
  tags: ["card"],
  status: "experimental",
  frame: { height: 330 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="card"]' }],
});
