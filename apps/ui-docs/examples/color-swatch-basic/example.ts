import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatch: Usage",
  summary: 'ColorSwatch demo "Usage".',
  tags: ["color-swatch"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-swatch]", "role", "img"] }],
});
