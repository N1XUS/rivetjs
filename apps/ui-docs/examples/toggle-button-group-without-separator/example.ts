import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Without Separator",
  summary: 'ToggleButtonGroup demo "Without Separator".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button-group"]' }],
});
