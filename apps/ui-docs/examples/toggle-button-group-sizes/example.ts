import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Sizes",
  summary: 'ToggleButtonGroup demo "Sizes".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 308 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button-group"]' }],
});
