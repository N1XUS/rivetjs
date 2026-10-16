import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Docs Site",
  summary: "A documentation header: brand with a version chip, section links, search and theme buttons.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 320, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "nav[aria-label=Documentation]" }, { matches: "[data-slot=navbar-separator], .navbar__separator" }],
});
