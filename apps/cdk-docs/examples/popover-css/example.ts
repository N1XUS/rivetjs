import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Popover with plain CSS",
  summary:
    "No utilities: rules for rv-Button, rv-Popover, rv-OverlayArrow, [data-placement] and the data-entering / data-exiting states, plus the trigger-anchor-point transform origin.",
  tags: ["popover", "css", "transition"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#pcss-trigger", "class", "rv-Button"] },
    { click: "#pcss-trigger" },
    { matches: ".rv-Popover:has(#pcss) .rv-OverlayArrow[data-placement=bottom] .tip" },
    { attr: ["#pcss", "class", "rv-Dialog"] },
    { absent: ".rv-Popover[data-entering]" },
    { key: "Escape" },
    { absent: "#pcss" },
  ],
});
