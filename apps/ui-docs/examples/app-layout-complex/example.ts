import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AppLayout: Complex",
  summary:
    "A full app shell: a compact sidebar with several menu groups and chips, breadcrumbs that follow the current page, navbar actions and a user dropdown.",
  tags: ["app-layout", "layout", "sidebar", "breadcrumbs", "dropdown"],
  status: "experimental",
  frame: { height: 560, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#alc-support", "aria-current", "page"] },
    { expect: ["#alc-crumbs", "Agents"] },
    { expect: ["#alc-chip-research", "New"] },
    { click: "#alc-threads" },
    { attr: ["#alc-threads", "aria-current", "page"] },
    { expect: ["#alc-title", "Saved threads"] },
    { expect: ["#alc-crumbs", "Knowledge"] },
    { click: "#alc-user" },
    { matches: "[role=menu][aria-label=Account]" },
    { key: "Escape" },
    { absent: "[role=menu]" },
    { click: "#alc-trigger" },
    { attr: ['[data-app-layout="app-layout-complex"] > [data-slot="sidebar"]', "data-collapsible", "icon"] },
  ],
});
