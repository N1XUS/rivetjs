import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: reduced motion",
  summary: "reduceMotion on the provider: the collapse, sub menus, pages and the mobile sheet switch without animation.",
  tags: ["sidebar", "motion", "a11y"],
  status: "experimental",
  frame: { height: 360, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-slot="sidebar-wrapper"]', "data-reduce-motion", "true"] },
    { click: "#srm-files" },
    { attr: ["#srm-files", "aria-expanded", "true"] },
    { click: "#srm-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
