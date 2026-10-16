import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: Kanban",
  summary:
    "A launch board: three connected drop lists (Angular CDK drag-drop) with sortable task cards, move buttons as the keyboard alternative, per-column add forms and a progress bar for done tasks.",
  tags: ["showcase", "drag-drop", "chip", "avatar-group", "progress-bar"],
  status: "experimental",
  frame: { height: 680 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#done-count", "2 of 8"] },
    { click: "#next-t5" },
    { expect: ["#col-done", "Lookbook shoot"] },
    { expect: ["#done-count", "3 of 8"] },
    { click: "#add-todo" },
    { fill: ["#new-todo", "Send samples to the press"] },
    { click: "#save-todo" },
    { expect: ["#col-todo", "Send samples to the press"] },
    { expect: ["#done-count", "3 of 9"] },
  ],
});
