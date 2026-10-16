import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar in a dialog",
  summary:
    "Port of shadcn/ui block sidebar-13: a settings Modal (open on load) whose content is its own SidebarProvider with a non-collapsible sidebar (collapsible=none) of menu buttons selecting the page.",
  tags: ["sidebar", "dialog", "blocks"],
  status: "experimental",
  frame: { height: "xl" },
  show: ["src/routes/index.tsx"],
  test: [
    // Open on load (upstream useState(true)).
    { matches: "#s13-dialog" },
    { name: ["#s13-dialog", "Settings"] },
    { described: ["#s13-dialog", "Customize your settings here."] },
    { attr: ['#s13-dialog [data-slot="sidebar"]', "data-state", null] },
    { expect: ['#s13-dialog [data-slot="sidebar-menu-button"][data-active="true"]', "Messages & media"] },
    { click: '#s13-dialog [data-slot="sidebar-menu-button"]:not([data-active])' },
    { expect: ["#s13-page", "Notifications"] },
    { expect: ['#s13-dialog [data-slot="sidebar-menu-button"][data-active="true"]', "Notifications"] },
    // Ctrl+B does nothing visible: the dialog's sidebar does not collapse.
    { key: "Escape" },
    { absent: "#s13-dialog" },
    { click: "#s13-open" },
    { matches: "#s13-dialog" },
  ],
});
