import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListView: Usage",
  summary: "Files with an icon, a title and a description; pressing a row runs its action.",
  tags: ["list-view"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#lv-basic-status", "Press a file"],
    },
    {
      click: "#lv-basic [role=row][data-key=budget]",
    },
    {
      expect: ["#lv-basic-status", "Opened budget"],
    },
  ],
});
