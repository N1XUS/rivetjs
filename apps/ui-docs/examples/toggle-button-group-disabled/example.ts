import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Disabled",
  summary: 'ToggleButtonGroup demo "Disabled".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 216 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button-group"]' }],
});
