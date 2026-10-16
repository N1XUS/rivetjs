import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chip: Usage",
  summary: 'Chip demo "Usage".',
  tags: ["chip"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="chip"]' }],
});
