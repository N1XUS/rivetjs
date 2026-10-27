import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: Custom Indicator",
  summary: "indicator replaces the chevron; as a function it gets the row's render props (isExpanded()), like icon.",
  tags: ["file-tree"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#ft-indicator [role=row][data-key=lib] [slot=chevron]",
    },
    {
      matches: "#ft-indicator [role=row][data-key=utils]",
    },
  ],
});
