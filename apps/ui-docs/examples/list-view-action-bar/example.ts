import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListView: With Action Bar",
  summary: "Bulk actions for the selected rows in an ActionBar; trailing per-row actions in ItemAction.",
  tags: ["list-view"],
  status: "experimental",
  frame: { height: 440 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#lv-bar [role=row][data-key=alan]",
    },
    {
      expect: ["#lv-bar-count", "1"],
    },
  ],
});
