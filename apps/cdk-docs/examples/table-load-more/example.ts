import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: infinite loading",
  summary: "TableLoadMoreItem after the rows: its sentinel calls onLoadMore as the scroll container nears the end; its content shows while isLoading.",
  tags: ["table", "loading", "async"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#planets-10-name", "Planet 10"] },
    { absent: "#planets-11-name" },
    { wheel: ["#planets-scroll", 600] },
    { expect: ["#planets-11-name", "Planet 11"] },
    { wheel: ["#planets-scroll", 1200] },
    { expect: ["#planets-30-name", "Planet 30"] },
  ],
});
