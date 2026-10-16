import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Async Loading",
  summary: "`onLoadMore` + `isLoadingMore`: the next page loads when the sentinel row scrolls into view (spinner by default).",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 372, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["tbody tr[data-key='0'] [data-column=kind]", "deploy"],
    },
  ],
});
