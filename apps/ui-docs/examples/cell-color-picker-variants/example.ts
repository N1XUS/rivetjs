import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellColorPicker: Variants",
  summary: "default (gray cell for pages) and secondary (surface cell inside gray containers).",
  tags: ["cell-color-picker"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [],
});
