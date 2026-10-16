import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "DataGrid: Controlled (server-side)",
  summary: "A controlled `sortDescriptor` makes the grid display the data as given: sort it yourself (here: a simulated request).",
  tags: ["data-grid"],
  status: "experimental",
  frame: { height: 390, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "thead th[data-column=name]",
    },
    {
      expect: ["#data-grid-server-sorting-status", "Sorted by name (ascending)"],
    },
  ],
});
