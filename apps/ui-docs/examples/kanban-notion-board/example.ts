import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kanban: Notion Board",
  summary: "Rich cards with tags and dates; Kanban.DragHandle adds a grip that shows on hover and focus.",
  tags: ["kanban"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kanban-notion-board .kanban__card",
    },
  ],
});
