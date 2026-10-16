import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Positioning",
  summary: 'position: "sticky" (default) sticks to the top, "static" scrolls with the page, "floating" is an inset rounded bar.',
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 360, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [{ matches: "nav.navbar--floating" }, { matches: "nav.navbar--static" }, { matches: "nav.navbar--sticky" }],
});
