import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kanban: Keyboard moves",
  summary:
    "onCardMove makes cards focusable and movable from the keyboard: Space picks a card up, arrow keys move it within and between columns, Space drops it, Escape puts it back. Each step is announced.",
  tags: ["kanban", "keyboard", "a11y"],
  status: "experimental",
  frame: { height: 460 },
  show: ["src/routes/index.tsx"],
  test: [
    { described: ['#kanban-kbd [data-kanban-key="1"]', "Press Space to pick up"] },
    { press: ['#kanban-kbd [data-kanban-key="1"]', " "] },
    { matches: '#kanban-kbd [data-kanban-key="1"][data-grabbed]' },
    { key: "ArrowRight" },
    { matches: '#kanban-kbd [data-kanban-column="progress"] [data-kanban-key="1"]' },
    { focused: '[data-kanban-key="1"]' },
    { key: " " },
    { absent: "#kanban-kbd [data-grabbed]" },
    { expect: ["#kanban-kbd-progress-count", "2"] },
    { press: ['#kanban-kbd [data-kanban-key="5"]', "Enter"] },
    { key: "ArrowLeft" },
    { matches: '#kanban-kbd [data-kanban-column="progress"] [data-kanban-key="5"]' },
    { focused: '[data-kanban-key="5"]' },
    { key: "Escape" },
    { matches: '#kanban-kbd [data-kanban-column="done"] [data-kanban-key="5"]' },
  ],
});
