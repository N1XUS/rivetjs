import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Breadcrumbs with Tailwind",
  summary:
    "Breadcrumbs styled with Tailwind: class on Breadcrumbs and each Breadcrumb, after: separators on items that are not current, data-[current]: for the last one.",
  tags: ["breadcrumbs", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: "#tw-trail.flex" }, { matches: "#tw-trail li.text-slate-500[data-current]" }],
});
