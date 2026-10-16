import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ButtonGroup: Orientation",
  summary: 'ButtonGroup demo "Orientation".',
  tags: ["button-group"],
  status: "experimental",
  frame: { height: 244 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button-group"]' }],
});
