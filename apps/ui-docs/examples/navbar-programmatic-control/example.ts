import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Programmatic Control",
  summary: "The menu state in a two-way signal, plus useNavbar() inside the bar.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#navbar-open-menu" },
    { expect: ["#navbar-menu-state", "open"] },
    { attr: ["[data-slot=navbar-menu-toggle]", "aria-expanded", "true"] },
    { click: "[data-slot=navbar-menu-toggle]" },
    { expect: ["#navbar-menu-state", "closed"] },
  ],
});
