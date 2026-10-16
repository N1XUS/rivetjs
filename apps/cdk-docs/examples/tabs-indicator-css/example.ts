import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Selection indicator with plain CSS",
  summary:
    "styles.css targets .rv-SelectionIndicator: transition-property lists what animates; [data-entering] / [data-exiting] style the first appearance; prefers-reduced-motion turns it off.",
  tags: ["aria", "tabs", "css", "animation"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#underline-tab-html > .rv-SelectionIndicator" },
    { click: "#underline-tab-javascript" },
    { attr: ["#underline-tab-javascript", "aria-selected", "true"] },
    { matches: "#underline-tab-javascript > .rv-SelectionIndicator" },
    { absent: "#underline-tab-html .rv-SelectionIndicator" },
    { press: ["#underline-tab-javascript", "ArrowLeft"] },
    { matches: "#underline-tab-css > .rv-SelectionIndicator" },
    { absent: "#underline-tab-javascript .rv-SelectionIndicator" },
  ],
});
