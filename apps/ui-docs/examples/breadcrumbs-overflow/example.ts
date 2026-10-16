import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs: Overflow",
  summary: 'Rivet addition: overflowMode="collapse" collapses the breadcrumbs that do not fit into a Dropdown after the root; drag the box corner to resize.',
  tags: ["breadcrumbs", "overflow", "dropdown"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=breadcrumbs] > li[data-overflow] button[aria-label='Show hidden pages']" },
    { attr: ["[data-slot=breadcrumbs] > li:first-child a", "href", "#home"] },
    // Rows the overflow re-creates on the resumed page keep the slot classes (the Breadcrumbs context is read at render time).
    { absent: "[data-slot=breadcrumbs] > li:not(.breadcrumbs__item)" },
    { absent: "[data-slot=breadcrumbs-separator]:not(.breadcrumbs__separator)" },
    { attr: ["[data-slot=breadcrumbs] > li:last-child", "data-current", "true"] },
    { click: "button[aria-label='Show hidden pages']" },
    { matches: "[role=menu] a[role=menuitem][href='#components']" },
    { click: "[role=menu] [data-key=components]" },
    { absent: "[role=menu]" },
    { expect: ["#opened-page", "Opened: Components"] },
  ],
});
