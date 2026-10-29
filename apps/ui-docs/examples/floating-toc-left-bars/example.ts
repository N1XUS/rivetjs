import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: Left Aligned Bars",
  summary: 'A right-hand TOC whose bars grow from the left edge: data-placement="left" on the trigger, the list still opens to the left.',
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#toc-left-bars", "data-placement", "left"],
    },
    {
      hover: "#toc-left-bars",
    },
    {
      click: "#toc-left-bars-usage",
    },
    {
      attr: ["#toc-left-bars [data-slot=floating-toc-bar]:nth-child(5)", "data-active", "true"],
    },
  ],
});
