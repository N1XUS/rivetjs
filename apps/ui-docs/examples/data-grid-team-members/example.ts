import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Team Members",
  summary: "Search, a status filter, column visibility and client-side pagination around one grid.",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 488, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#data-grid-team-members-count", "24 members"],
    },
  ],
});
