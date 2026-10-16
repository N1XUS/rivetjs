import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tabs with an animated selection indicator",
  summary: "A <SelectionIndicator /> in every tab: the underline pill moves to the selected tab, animating translate and width (motion-safe: only).",
  tags: ["aria", "tabs", "tailwind", "animation"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#pill-tab-overview > .bg-indigo-600" },
    { absent: "#pill-tab-pricing .bg-indigo-600" },
    { click: "#pill-tab-pricing" },
    { attr: ["#pill-tab-pricing", "aria-selected", "true"] },
    { matches: "#pill-tab-pricing > .bg-indigo-600" },
    { absent: "#pill-tab-overview .bg-indigo-600" },
    { press: ["#pill-tab-pricing", "ArrowRight"] },
    { matches: "#pill-tab-changelog > .bg-indigo-600" },
    { absent: "#pill-tab-pricing .bg-indigo-600" },
  ],
});
