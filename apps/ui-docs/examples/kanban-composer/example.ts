import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kanban: Add a card",
  summary:
    "KanbanComposer under each column: the trigger opens an inline title field, Enter or Add card appends the card, Escape or Cancel closes and focus returns to the trigger.",
  tags: ["kanban", "text-field"],
  status: "experimental",
  frame: { height: 460 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#kanban-add-todo" },
    { focused: "#kanban-add-todo-input" },
    { fill: ["#kanban-add-todo-input", "Plan the offsite"] },
    { click: "#kanban-add-todo-submit" },
    { expect: ['#kanban-add [data-kanban-column="todo"]', "Plan the offsite"] },
    { expect: ["#kanban-add-todo-count", "3"] },
    { focused: "#kanban-add-todo" },
    { click: "#kanban-add-done" },
    { press: ["#kanban-add-done-input", "Escape"] },
    { focused: "#kanban-add-done" },
    { absent: "#kanban-add-done-input" },
  ],
});
