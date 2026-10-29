import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: Sections",
  summary: "Rows grouped under section headers; each section is a labelled row group and its folders expand as usual.",
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#ft-sections [role=rowgroup] .file-tree__section-header" },
    { absent: "#ft-sections [role=row][data-key=button]" },
    { click: "#ft-sections [role=row][data-key=components] [slot=chevron]" },
    { matches: "#ft-sections [role=row][data-key=button]" },
    { matches: "#ft-sections [role=row][data-key=components][data-expanded=true]" },
  ],
});
