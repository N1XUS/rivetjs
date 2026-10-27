import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: Usage",
  summary: "Hover the bars to open the section list; the active section is highlighted in both.",
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      name: ["#toc-basic", "Table of contents"],
    },
    {
      hover: "#toc-basic",
    },
    {
      click: "#toc-basic-install",
    },
    {
      attr: ["#toc-basic-install", "data-active", "true"],
    },
  ],
});
