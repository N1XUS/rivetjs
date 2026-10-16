import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Separator: Variants",
  summary: 'Separator demo "Variants".',
  tags: ["separator"],
  status: "experimental",
  frame: { height: 191 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="separator"]' }],
});
