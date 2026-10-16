import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatch: Tailwind CSS",
  summary: 'ColorSwatch demo "Tailwind CSS".',
  tags: ["color-swatch"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-slot=color-swatch][style*=box-shadow]" }],
});
