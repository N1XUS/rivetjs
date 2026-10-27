import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Inset dashboard",
  summary: "A dashboard on the inset sidebar: off-canvas collapse, KPIs in the page and a user menu in the sidebar footer.",
  tags: ["app-layout", "layout", "dashboard"],
  status: "experimental",
  frame: { height: 532, auto: true, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-app-layout="app-layout-inset-dashboard"] > [data-slot="sidebar"]', "data-variant", "inset"] },
    { matches: "#aid-kpis" },
    { click: "#aid-user" },
    { matches: "[role=menu][aria-label=Account]" },
    { key: "Escape" },
    { click: "#aid-trigger" },
    { attr: ['[data-app-layout="app-layout-inset-dashboard"] > [data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
