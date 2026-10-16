import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Column Resizing",
  summary: "`allowsColumnResize`: drag the separators (or focus one and use the arrow keys); min / max widths clamp.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 390, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["thead [data-rv-resizer=name]", ""],
    },
  ],
});
