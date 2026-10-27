import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: Usage",
  summary: "Folders and files with icons; the chevron or ArrowRight / ArrowLeft expands and collapses a folder.",
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#ft-basic [role=row][data-key=button]",
    },
    {
      click: "#ft-basic [role=row][data-key=src] [slot=chevron]",
    },
    {
      absent: "#ft-basic [role=row][data-key=index]",
    },
  ],
});
