import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: navigate Callback",
  summary: "Option 2: the Navbar's own navigate callback routes its item links client-side.",
  tags: ["navbar"],
  status: "experimental",
  frame: { height: 320, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "[data-slot=navbar-item][href='/drafts']" },
    { expect: ["#navbar-route-path", "/drafts"] },
    { attr: ["[data-slot=navbar-item][href='/drafts']", "aria-current", "page"] },
  ],
});
