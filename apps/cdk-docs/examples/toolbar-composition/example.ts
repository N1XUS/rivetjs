import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toolbar of cdk components",
  summary: "A Toolbar composed of ToggleButtons, a Group of Buttons and a Link; each keeps its own events while the Toolbar handles the arrow keys.",
  tags: ["toolbar", "composition", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#c-bold" },
    { attr: ["#c-bold", "aria-pressed", "true"] },
    { expect: ["#c-log", "bold:true"] },
    { key: "ArrowRight" },
    { focused: "#c-undo" },
    { key: "Enter" },
    { expect: ["#c-log", "undo"] },
    { key: "ArrowRight" },
    { focused: "#c-redo" },
    { key: "ArrowRight" },
    { focused: "#c-help" },
  ],
});
