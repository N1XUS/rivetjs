import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorField: Usage",
  summary: 'ColorField demo "Usage".',
  tags: ["color-field"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ fill: ["[data-slot=color-input-group-input]", "#22c55e"] }, { key: "Tab" }, { matches: '[data-slot=color-swatch][style*="34, 197, 94"]' }],
});
