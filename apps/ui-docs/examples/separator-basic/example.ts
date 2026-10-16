import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Separator: Usage",
  summary: 'Separator demo "Usage".',
  tags: ["separator"],
  status: "experimental",
  frame: { height: 161 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="separator"]' }],
});
