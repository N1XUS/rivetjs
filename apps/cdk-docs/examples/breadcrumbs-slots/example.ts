import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs custom content",
  summary:
    "An items render function with a Breadcrumb render prop: your own Link (it still gets aria-current and disabled from the Breadcrumb) plus an icon, and a separator unless isCurrent().",
  tags: ["breadcrumbs", "slots"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#crumbs li:first-child a.crumb[href='#shop']" },
    { matches: "#crumbs li:first-child .sep svg" },
    { attr: ["#crumbs li:last-child .crumb", "aria-current", "page"] },
    { absent: "#crumbs li:last-child .sep" },
  ],
});
