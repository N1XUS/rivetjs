import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ButtonGroup: Sizes",
  summary: 'ButtonGroup demo "Sizes".',
  tags: ["button-group"],
  status: "experimental",
  frame: { height: 292 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button-group"]' }],
});
