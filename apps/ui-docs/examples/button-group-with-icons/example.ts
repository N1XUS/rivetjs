import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ButtonGroup: With Icons",
  summary: 'ButtonGroup demo "With Icons".',
  tags: ["button-group"],
  status: "experimental",
  frame: { height: 216 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button-group"]' }],
});
