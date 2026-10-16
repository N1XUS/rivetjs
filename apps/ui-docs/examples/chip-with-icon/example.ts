import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chip: With Icons",
  summary: 'Chip demo "With Icons".',
  tags: ["chip"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="chip"]' }],
});
