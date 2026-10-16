import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ProgressBar with plain CSS",
  summary: "styles.css targets .rv-ProgressBar and [aria-valuenow]; the indeterminate bar animates with :not([aria-valuenow]); a starter theme is not needed.",
  tags: ["progress-bar", "css", "styling"],
  status: "experimental",
  frame: { height: 104, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { attr: ["#css-copy", "class", "rv-ProgressBar"] },
    { attr: ["#css-copy", "style", "--fill:45%"] },
    { matches: ".rv-ProgressBar:not([aria-valuenow])#css-wait" },
    { name: ["#css-wait", "Waiting for server"] },
  ],
});
