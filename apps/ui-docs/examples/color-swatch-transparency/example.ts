import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatch: Transparency",
  summary: 'ColorSwatch demo "Transparency".',
  tags: ["color-swatch"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-swatch]", "aria-label", "vibrant cyan blue, 100% opacity"] }],
});
