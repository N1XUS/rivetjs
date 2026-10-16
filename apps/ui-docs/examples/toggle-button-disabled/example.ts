import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton: Disabled",
  summary: 'ToggleButton demo "Disabled".',
  tags: ["toggle-button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button"]' }],
});
