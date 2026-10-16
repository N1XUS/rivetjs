import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Indeterminate ProgressBar",
  summary:
    "isIndeterminate drops aria-valuenow / aria-valuetext and makes percentage() undefined; style the moving bar with :not([aria-valuenow]) or the class render prop.",
  tags: ["progress-bar", "indeterminate"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#sync", "aria-valuenow", null] },
    { attr: ["#sync", "aria-valuetext", null] },
    { matches: "#sync.busy" },
    { expect: ["#sync-text", "Working"] },
    { click: "label:has(#known)" },
    { attr: ["#sync", "aria-valuenow", "60"] },
    { expect: ["#sync-text", "60%"] },
    { absent: "#sync.busy" },
  ],
});
