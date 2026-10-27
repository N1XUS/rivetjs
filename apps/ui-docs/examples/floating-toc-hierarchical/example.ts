import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: Hierarchical",
  summary: "level makes nested bars shorter and nested items indented.",
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      hover: "#toc-levels",
    },
    {
      matches: "#toc-levels-config",
    },
  ],
});
