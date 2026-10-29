import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: With Icons",
  summary: "An icon per file type; folder icons are functions of the row state and open while the folder is expanded.",
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#ft-with-icons [role=row][data-key=main] [data-slot=file-tree-icon] svg",
    },
    {
      click: "#ft-with-icons [role=row][data-key=assets] [slot=chevron]",
    },
    {
      matches: "#ft-with-icons [role=row][data-key=logo]",
    },
    {
      matches: "#ft-with-icons [role=row][data-key=assets] [data-slot=file-tree-icon] svg",
    },
  ],
});
