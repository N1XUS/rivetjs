import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Separator: With Content",
  summary: 'Separator demo "With Content".',
  tags: ["separator"],
  status: "experimental",
  frame: { height: 266 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="separator"]' }],
});
