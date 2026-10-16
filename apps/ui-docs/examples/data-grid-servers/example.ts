import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Servers",
  summary: "An operations view: secondary variant, top-aligned rows, usage bars and a row action.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 346, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "tbody tr[data-key='db'] [data-column=host]",
    },
    {
      expect: ["#data-grid-servers-opened", "Opened db"],
    },
  ],
});
