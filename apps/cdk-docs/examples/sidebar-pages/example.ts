import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar pages and shortcut",
  summary:
    "SidebarPages slides between a main page and a settings page (drill in / back with useSidebarPages), a custom toggleShortcut (Alt+S) and an opaque mobile backdrop.",
  tags: ["sidebar", "navigation", "motion"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-slot="sidebar-page"][data-value="main"]', "data-active", "true"] },
    { click: "#sp-settings" },
    { attr: ['[data-slot="sidebar-page"][data-value="settings"]', "data-active", "true"] },
    { expect: ["#sp-page", "settings"] },
    { click: "#sp-back" },
    { attr: ['[data-slot="sidebar-page"][data-value="main"]', "data-active", "true"] },
    { expect: ["#sp-page", "main"] },
    { press: ["#sp-settings", "Alt+s"] },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
