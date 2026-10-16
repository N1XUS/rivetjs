import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: pages",
  summary: "Sidebar.Pages switches the sidebar content with a slide: Settings drills in, Back returns (useSidebarPages).",
  tags: ["sidebar", "navigation", "pages", "motion"],
  status: "experimental",
  frame: { height: 480, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-slot="sidebar-page"][data-value="main"]', "data-active", "true"] },
    { click: "#sp-settings" },
    { attr: ['[data-slot="sidebar-page"][data-value="settings"]', "data-active", "true"] },
    { attr: ['[data-slot="sidebar-page"][data-value="main"]', "aria-hidden", "true"] },
    { expect: ["#sp-active", "settings"] },
    { click: "#sp-back" },
    { attr: ['[data-slot="sidebar-page"][data-value="main"]', "data-active", "true"] },
  ],
});
