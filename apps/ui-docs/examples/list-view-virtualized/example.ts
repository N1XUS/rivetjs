import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListView: Virtualized",
  summary: "virtualized renders only the rows in view; give the list a fixed height and a rowHeight.",
  tags: ["list-view"],
  status: "experimental",
  frame: { height: 440 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#lv-virtual [role=row][data-key='0']",
    },
    {
      absent: "#lv-virtual [role=row][data-key='4999']",
    },
    {
      wheel: ["#lv-virtual [role=grid]", 2200],
    },
    {
      matches: "#lv-virtual [role=row][data-key='52']",
    },
    {
      absent: "#lv-virtual [role=row][data-key='0']",
    },
  ],
});
