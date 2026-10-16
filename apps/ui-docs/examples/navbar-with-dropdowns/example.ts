import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: With Dropdowns",
  summary: "A Dropdown inside the bar for a group of links.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 320, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-slot=navbar-content] button" }, { matches: "[role=menu]" }, { key: "Escape" }, { absent: "[role=menu]" }],
});
