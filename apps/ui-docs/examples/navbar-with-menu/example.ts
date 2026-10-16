import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: With Menu",
  summary: "A menu toggle opens the full-width menu below the bar; Escape or a menu item closes it.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=navbar-menu-toggle]" },
    { attr: ["[data-slot=navbar-menu-toggle]", "aria-expanded", "true"] },
    { matches: "[data-slot=navbar-menu][data-open=true]" },
    { key: "Escape" },
    { attr: ["[data-slot=navbar-menu-toggle]", "aria-expanded", "false"] },
  ],
});
