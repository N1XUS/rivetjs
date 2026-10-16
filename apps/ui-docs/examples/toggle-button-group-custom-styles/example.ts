import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButtonGroup: Tailwind CSS",
  summary: 'ToggleButtonGroup demo "Tailwind CSS".',
  tags: ["toggle-button-group"],
  status: "experimental",
  frame: { height: 106 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button-group"]' }],
});
