import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Separator: Tailwind CSS",
  summary: 'Separator demo "Tailwind CSS".',
  tags: ["separator"],
  status: "experimental",
  frame: { height: 129 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="separator"]' }],
});
