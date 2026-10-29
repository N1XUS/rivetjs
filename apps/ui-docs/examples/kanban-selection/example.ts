import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kanban: Card selection",
  summary:
    "selectionMode on a card list selects cards like a GridList: click or Space toggles a card, arrow keys move focus, Shift extends, Escape clears. Selected cards carry data-selected; selectedKeys takes a signal.",
  tags: ["kanban", "selection", "keyboard", "a11y"],
  status: "experimental",
  frame: { height: 500 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#kanban-select-backlog", "role", "grid"] },
    { attr: ["#kanban-select-backlog", "aria-multiselectable", "true"] },
    { attr: ['#kanban-select [data-kanban-key="2"]', "aria-selected", "true"] },
    { click: '#kanban-select [data-kanban-key="1"]' },
    { attr: ['#kanban-select [data-kanban-key="1"]', "aria-selected", "true"] },
    { expect: ["#kanban-select-backlog-selected", "2 selected"] },
    { key: "ArrowDown" },
    { focused: '#kanban-select [data-kanban-key="2"]' },
    { key: " " },
    { attr: ['#kanban-select [data-kanban-key="2"]', "aria-selected", "false"] },
    { expect: ["#kanban-select-backlog-selected", "1 selected"] },
    { key: "Escape" },
    { absent: "#kanban-select-backlog [data-selected]" },
  ],
});
