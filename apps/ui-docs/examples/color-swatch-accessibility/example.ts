import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ColorSwatch: Accessibility",
  summary: 'ColorSwatch demo "Accessibility".',
  tags: ["color-swatch"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["[data-slot=color-swatch]", "aria-label", "Ocean Blue, Primary brand color"] }],
});
