import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSlider: Secondary Group",
  summary: 'variant="secondary" cells on a gray panel: the surface-colored track stands out from the panel.',
  tags: ["cell-slider"],
  status: "experimental",
  frame: { height: 280 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".cell-slider--secondary" }],
});
