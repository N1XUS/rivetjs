import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Kanban: Project Board",
  summary: "Owners, estimates and an urgent flag; column actions reveal on header hover.",
  tags: ["kanban"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#kanban-project-board .kanban__card",
    },
  ],
});
