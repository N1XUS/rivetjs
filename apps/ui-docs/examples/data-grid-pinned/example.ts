import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Pinned Columns",
  summary: '`pinned: "start" | "end"` keeps columns in place while the others scroll horizontally.',
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 430, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-key='1'] [data-column=name][data-pinned=start]", "Mara Quinn"],
    },
  ],
});
