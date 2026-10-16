import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toolbar with Tailwind",
  summary:
    "A Toolbar styled with Tailwind: orientation-horizontal: / orientation-vertical: variants from @rivetjs/cdk/tailwind.css and aria-pressed: on its toggles.",
  tags: ["toolbar", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-tools.rounded-lg" },
    { click: "#tw-grid" },
    { attr: ["#tw-grid", "aria-pressed", "true"] },
    { key: "ArrowRight" },
    { focused: "#tw-snap" },
  ],
});
