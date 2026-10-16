import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: empty state",
  summary: "renderEmptyState on TableBody: one row with a cell spanning every column while the body has no rows; the body gets data-empty.",
  tags: ["table", "empty"],
  status: "experimental",
  frame: { height: 117, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#results tbody", "data-empty", "true"] },
    { attr: ["#results tbody td", "colspan", "3"] },
    { expect: ["#results tbody [role=rowheader]", "No results found."] },
  ],
});
