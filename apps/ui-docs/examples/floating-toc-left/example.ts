import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: Left Placement",
  summary: 'placement="left" aligns the bars to the left and opens the list to the right.',
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#toc-left", "data-placement", "left"],
    },
  ],
});
