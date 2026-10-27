import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListView: Empty State",
  summary: "renderEmptyState shows a placeholder when there are no items.",
  tags: ["list-view"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#lv-empty [data-slot=list-view-empty-state]", "No messages"],
    },
  ],
});
