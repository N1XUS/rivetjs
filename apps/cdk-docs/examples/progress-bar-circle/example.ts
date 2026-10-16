import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressCircle",
  summary: "A circular progress indicator: an SVG inside ProgressBar whose stroke-dashoffset comes from percentage(); indeterminate spins.",
  tags: ["progress-bar", "svg"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#circle", "aria-valuenow", "30"] },
    { attr: ["#circle", "aria-label", "Loading…"] },
    { attr: ["#spinner", "aria-valuenow", null] },
    { matches: "#spinner svg.animate-spin" },
  ],
});
