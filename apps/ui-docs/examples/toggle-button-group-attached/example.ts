import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Detached",
  summary: 'ToggleButtonGroup demo "Detached".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 216 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button-group"]' }],
});
