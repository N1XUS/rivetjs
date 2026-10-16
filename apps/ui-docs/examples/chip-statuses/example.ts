import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chip: Statuses",
  summary: 'Chip demo "Statuses".',
  tags: ["chip"],
  status: "experimental",
  frame: { height: 120 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="chip"]' }],
});
