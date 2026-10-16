import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton: Variants",
  summary: 'ToggleButton demo "Variants".',
  tags: ["toggle-button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button"]' }],
});
