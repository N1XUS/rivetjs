import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton: Sizes",
  summary: 'ToggleButton demo "Sizes".',
  tags: ["toggle-button"],
  status: "experimental",
  frame: { height: 168 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button"]' }],
});
