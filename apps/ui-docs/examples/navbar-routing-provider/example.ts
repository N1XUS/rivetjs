import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Navbar: Global RouterProvider",
  summary: "Option 1: a cdk RouterProvider above the bar routes every item link client-side.",
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
