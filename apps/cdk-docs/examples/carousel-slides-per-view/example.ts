import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Responsive slides per view",
  summary: "embla's Slides Per View example: one slide on small screens, two from sm and three from lg; embla re-measures on resize and the dots follow.",
  tags: ["carousel", "responsive", "tailwind"],
  status: "experimental",
  frame: { height: 244, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ attr: ["#per-view-slide-0", "data-snapped", "true"] }, { click: "#next" }, { attr: ["#per-view-tab-1", "aria-selected", "true"] }],
});
