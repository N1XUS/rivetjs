import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ButtonGroup: Usage",
  summary: 'ButtonGroup demo "Usage".',
  tags: ["button-group"],
  status: "experimental",
  frame: { height: 472 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="button-group"]' }, { click: "button[aria-label='More options']" }, { expect: ["[role=menu]", "Squash and merge"] }],
});
