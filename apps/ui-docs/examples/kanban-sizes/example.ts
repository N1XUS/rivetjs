import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kanban: Sizes",
  summary: 'size="sm" narrows the columns (240px), the gap and the card padding; md is the default, lg widens them (320px).',
  tags: ["kanban"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kanban-sizes .kanban__card",
    },
  ],
});
