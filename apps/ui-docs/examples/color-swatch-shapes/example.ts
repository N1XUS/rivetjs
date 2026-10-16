import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatch: Shapes",
  summary: 'ColorSwatch demo "Shapes".',
  tags: ["color-swatch"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-swatch].color-swatch--square" }],
});
