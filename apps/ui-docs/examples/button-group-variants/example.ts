import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ButtonGroup: Variants",
  summary: 'ButtonGroup demo "Variants".',
  tags: ["button-group"],
  status: "experimental",
  frame: { height: 584 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button-group"]' }],
});
