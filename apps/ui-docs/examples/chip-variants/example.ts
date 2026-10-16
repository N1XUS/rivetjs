import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chip: Variants",
  summary: 'Chip demo "Variants".',
  tags: ["chip"],
  status: "experimental",
  frame: { height: 786 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="chip"]' }],
});
