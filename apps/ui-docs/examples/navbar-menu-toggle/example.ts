import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Menu Toggle",
  summary:
    "Three toggles for one menu: the default morph burger (its bars slide together, then turn into an X), the same with size / stroke / duration hooks, and own lucide icons as children.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=navbar-menu-toggle]" },
    { attr: ["[data-slot=navbar-menu-toggle-icon]", "data-open", "true"] },
    { key: "Escape" },
    { attr: ["[data-slot=navbar-menu-toggle]", "aria-expanded", "false"] },
  ],
});
