import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList: empty state",
  summary: "renderEmptyState shows while a computed items list is empty; the grid gets data-empty.",
  tags: ["grid-list", "empty"],
  status: "experimental",
  frame: { height: 198, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#results-banana", "Banana"] },
    { fill: ["#search-query", "kiwi"] },
    { expect: ["#results", "No results found."] },
    { attr: ["#results", "data-empty", "true"] },
    { absent: "#results-banana" },
    { fill: ["#search-query", "an"] },
    { expect: ["#results-banana", "Banana"] },
    { attr: ["#results", "data-empty", null] },
  ],
});
