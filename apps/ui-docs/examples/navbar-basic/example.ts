import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Usage",
  summary: "A sticky bar with a brand, links (the current page marked with aria-current) and an action.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 320, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "nav[data-slot=navbar]" }, { attr: ["[data-slot=navbar-item][href='#pricing']", "aria-current", "page"] }],
});
