import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Separator: Vertical",
  summary: 'Separator demo "Vertical".',
  tags: ["separator"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="separator"]' }],
});
