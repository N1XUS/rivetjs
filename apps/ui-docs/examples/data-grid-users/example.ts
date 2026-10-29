import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Users",
  summary: "A minimal user directory: the secondary variant, plain value columns and one row action link.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 400, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "[role=grid] [role=row] a[aria-label='Edit Priya Raman']",
    },
    {
      absent: "[role=grid] [role=checkbox]",
    },
  ],
});
