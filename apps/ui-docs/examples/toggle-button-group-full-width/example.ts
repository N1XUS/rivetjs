import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Full Width",
  summary: 'ToggleButtonGroup demo "Full Width".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 148 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button-group"]' }],
});
