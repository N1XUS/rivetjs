import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "NavigationTree",
  summary: "A sidebar of nested links: selectedRoute marks the current item (aria-current, data-current) and its ancestors (data-current-ancestor).",
  tags: ["navigation-tree", "tree", "links", "router"],
  status: "experimental",
  frame: { height: 206, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#sidebar", "role", "treegrid"] },
    { attr: ["#sidebar-files", "aria-expanded", "true"] },
    { attr: ["#sidebar-photos", "data-current", "true"] },
    { attr: ["#sidebar-files", "data-current-ancestor", "true"] },
    { attr: ["#sidebar-photos a", "aria-current", "page"] },
    { attr: ["#sidebar-videos a", "href", "/videos"] },
    // A click goes through the RouterProvider; the new route becomes selectedRoute.
    { click: "#sidebar-videos a" },
    { expect: ["#sidebar-route", "Route: /videos"] },
    { attr: ["#sidebar-videos", "data-current", "true"] },
    { attr: ["#sidebar-photos", "data-current", null] },
    { attr: ["#sidebar-photos a", "aria-current", null] },
    // The chevron expands a parent row without following its link.
    { attr: ["#sidebar-shared", "aria-expanded", "false"] },
    { click: "#sidebar-shared-chevron" },
    { expect: ["#sidebar-food", "Food"] },
    // A parent without href: its link toggles the row instead of navigating.
    { click: "#sidebar-shared [role=link]" },
    { attr: ["#sidebar-shared", "aria-expanded", "false"] },
    { absent: "#sidebar-food" },
    { expect: ["#sidebar-route", "Route: /videos"] },
  ],
});
