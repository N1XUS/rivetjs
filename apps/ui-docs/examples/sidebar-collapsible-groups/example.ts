import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: collapsible groups (tree)",
  summary: "Expandable items with a rotating indicator, nested levels and guide lines shown on hover (showGuideLines: hover).",
  tags: ["sidebar", "navigation", "tree", "disclosure"],
  status: "experimental",
  frame: { height: 48, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#scg-guides", "aria-expanded", "true"] },
    { attr: ['[data-slot="sidebar-menu"]', "data-guide-lines", "hover"] },
    { click: "#scg-api" },
    { attr: ["#scg-api", "aria-expanded", "true"] },
    { expect: ["#scg-endpoints", "Endpoints"] },
    { press: ["#scg-guides", "Enter"] },
    { attr: ["#scg-guides", "aria-expanded", "false"] },
  ],
});
