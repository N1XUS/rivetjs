import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "CellSelect: Variants",
  summary: "default (gray cell) for pages, secondary (surface cell) inside gray containers.",
  tags: ["cell-select"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".cell-select__trigger--default" }, { matches: ".cell-select__trigger--secondary" }],
});
