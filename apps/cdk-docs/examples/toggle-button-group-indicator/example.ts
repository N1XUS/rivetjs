import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segmented control with SelectionIndicator",
  summary: "A SelectionIndicator in each ToggleButton slides between buttons: ToggleButtonGroup is the SharedElementTransition scope.",
  tags: ["toggle-button-group", "animation"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#range button:nth-child(2) > .rv-SelectionIndicator, #range button:nth-child(2) > [class*='absolute']" },
    { click: "#range button:nth-child(3)" },
    { attr: ["#range button:nth-child(3)", "aria-checked", "true"] },
    { absent: "#range button:nth-child(2) > .absolute" },
    { matches: "#range button:nth-child(3) > .absolute" },
  ],
});
