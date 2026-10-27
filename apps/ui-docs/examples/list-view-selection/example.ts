import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListView: Selection Modes",
  summary: 'selectionMode="multiple" adds a checkbox to every row; "single" keeps one row selected.',
  tags: ["list-view"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#lv-select-count", "0 selected"],
    },
    {
      click: "#lv-select [aria-label='Team (multiple)'] [role=row][data-key=ada]",
    },
    {
      click: "#lv-select [aria-label='Team (multiple)'] [role=row][data-key=grace]",
    },
    {
      expect: ["#lv-select-count", "2 selected"],
    },
  ],
});
