import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Usage",
  summary: 'ToggleButtonGroup demo "Usage".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button-group"]' }],
});
