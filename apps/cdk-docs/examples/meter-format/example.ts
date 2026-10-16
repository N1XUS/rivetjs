import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Meter value scale and formatting",
  summary:
    "minValue / maxValue set the range, formatOptions formats the value (units, currency), valueLabel replaces the text entirely; value can be an accessor.",
  tags: ["meter", "format"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#disk", "aria-valuetext", "512 MB"] },
    { attr: ["#disk-fill", "style", "width:50%"] },
    { click: "#more" },
    { attr: ["#disk", "aria-valuenow", "768"] },
    { expect: ["#disk-text", "768 MB"] },
    { matches: "#disk-fill[style*=\"75%\"]" },
    { attr: ["#budget", "aria-valuetext", "€300.00"] },
    { attr: ["#budget", "aria-valuemax", "1200"] },
    { expect: ["#steps-text", "3 of 4 steps"] },
    { attr: ["#steps", "aria-valuetext", "3 of 4 steps"] },
  ],
});
