import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ButtonGroup: Full Width",
  summary: 'ButtonGroup demo "Full Width".',
  tags: ["button-group"],
  status: "experimental",
  frame: { height: 148 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button-group"]' }],
});
