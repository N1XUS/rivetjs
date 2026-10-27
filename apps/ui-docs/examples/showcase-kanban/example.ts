import { defineExample } from "@rivetjs/docs-kit/define.ts";

const CARD = (id: string) => `#launch-board [data-kanban-key="${id}"]`;

export default defineExample({
  title: "Showcase: Kanban",
  summary:
    "A launch board on the ui Kanban: three connected columns with sortable task cards (mouse and touch drags), keyboard moves (Space picks a card up, arrow keys move it, Space drops it), a KanbanComposer per column and a progress bar for done tasks.",
  tags: ["showcase", "kanban", "drag-drop", "chip", "avatar-group", "progress-bar"],
  status: "experimental",
  frame: { height: 680 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#done-count", "2 of 8"] },
    { press: [CARD("t5"), " "] },
    { matches: `${CARD("t5")}[data-grabbed]` },
    { key: "ArrowRight" },
    { expect: ["#col-done", "Lookbook shoot"] },
    { focused: CARD("t5") },
    { key: " " },
    { absent: "#launch-board [data-grabbed]" },
    { expect: ["#done-count", "3 of 8"] },
    { click: "#add-todo" },
    { fill: ["#add-todo-input", "Send samples to the press"] },
    { click: "#add-todo-submit" },
    { expect: ["#col-todo", "Send samples to the press"] },
    { expect: ["#done-count", "3 of 9"] },
  ],
});
