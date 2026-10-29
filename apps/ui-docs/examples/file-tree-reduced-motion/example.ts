import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: Reduced Motion",
  summary: "reduceMotion turns off the chevron turn and the row colour transitions; the tree works the same.",
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#ft-reduced-motion [role=treegrid]", "data-reduce-motion", "true"],
    },
    {
      click: "#ft-reduced-motion [role=row][data-key=routes] [slot=chevron]",
    },
    {
      matches: "#ft-reduced-motion [role=row][data-key=home]",
    },
  ],
});
