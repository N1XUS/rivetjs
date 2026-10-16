import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ToggleButton: Icon Only",
  summary: 'ToggleButton demo "Icon Only".',
  tags: ["toggle-button"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="toggle-button"]' }],
});
