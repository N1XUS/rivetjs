import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Responsive Mobile Menu",
  summary: "Links in the bar on wide screens; below 768px they move into the menu behind the toggle.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "nav[data-slot=navbar]" }, { matches: "[data-slot=navbar-menu]:not([data-open])" }],
});
