import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Chip: Vibrant Palette",
  summary: 'Chip demo "Vibrant Palette": the default palette next to `data-vibrant-palette`.',
  tags: ["chip", "theming"],
  status: "experimental",
  frame: { height: 520, auto: true },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "[data-vibrant-palette=true] .chip" }],
});
