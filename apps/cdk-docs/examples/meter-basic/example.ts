import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Meter with a label and a fill",
  summary: "A Meter whose render props (percentage, valueText) size the fill and print the formatted value; the Label inside labels the meter.",
  tags: ["meter", "render-props"],
  status: "experimental",
  frame: { height: "xs" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#storage", "role", "meter"] },
    { attr: ["#storage", "aria-valuenow", "72"] },
    { attr: ["#storage", "aria-valuetext", "72%"] },
    { name: ["#storage", "Storage space"] },
    { expect: ["#storage-value", "72%"] },
    { attr: ["#storage-fill", "style", "width:72%"] },
  ],
});
