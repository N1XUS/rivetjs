import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: Multiple Selection",
  summary: 'selectionMode="multiple" adds a checkbox per row; selectedKeys holds the selection.',
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#ft-select-names", "Selected: index"],
    },
    {
      click: "#ft-select [role=row][data-key=readme]",
    },
    {
      expect: ["#ft-select-names", "Selected: index, readme"],
    },
  ],
});
