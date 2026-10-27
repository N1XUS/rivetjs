import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kanban: Usage",
  summary: "Drag cards within and between columns. createKanban keeps the cards in one signal; itemsOf(column) feeds a keyed For and onDropped moves the card.",
  tags: ["kanban"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kanban-basic .kanban__card",
    },
  ],
});
