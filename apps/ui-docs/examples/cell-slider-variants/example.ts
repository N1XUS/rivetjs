import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSlider: Variants",
  summary: "default (gray track) for pages, secondary (surface track) inside gray containers.",
  tags: ["cell-slider"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".cell-slider--default" }, { matches: ".cell-slider--secondary" }],
});
