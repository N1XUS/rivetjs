import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: conditional panels",
  summary: "Panels can come and go: the group re-registers its children and keeps the remaining sizes valid.",
  tags: ["resizable", "split-pane", "window-splitter"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#preview" },
    { click: "#toggle-preview" },
    { absent: "#preview" },
    { click: "#toggle-preview" },
    { matches: "#preview" },
    { press: ["#cond-sep", "ArrowRight"] },
    { attr: ["#cond-sep", "aria-valuenow", "55"] },
  ],
});
