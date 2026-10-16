import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Orientation",
  summary: 'ToggleButtonGroup demo "Orientation".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 204 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button-group"]' }],
});
