import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ButtonGroup: Disabled State",
  summary: 'ButtonGroup demo "Disabled State".',
  tags: ["button-group"],
  status: "experimental",
  frame: { height: 216 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button-group"]' }],
});
