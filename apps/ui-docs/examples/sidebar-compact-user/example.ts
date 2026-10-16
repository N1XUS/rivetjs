import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: compact with a user menu",
  summary: "A sidebar that collapses to icons, with an avatar in the header and a user menu (Dropdown) in the footer.",
  tags: ["sidebar", "navigation", "dropdown", "avatar"],
  status: "experimental",
  frame: { height: 480, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#scu-user" },
    { matches: "[role=menu]" },
    { key: "Escape" },
    { absent: "[role=menu]" },
    { click: "#scu-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-collapsible", "icon"] },
    { hover: "#scu-home" },
    { expect: ["[role=tooltip]", "Home"] },
  ],
});
