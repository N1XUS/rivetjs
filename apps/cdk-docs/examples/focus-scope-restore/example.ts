import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FocusScope restoreFocus and autoFocus",
  summary: "A panel shown on demand: autoFocus focuses its first field, contain keeps Tab inside, restoreFocus returns focus to the opener when it closes.",
  tags: ["cdk", "focus", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: "#panel-name" },
    { press: ["#open", "Enter"] },
    { focused: "#panel-name" },
    { key: "Tab" },
    { focused: "#panel-done" },
    { key: "Tab" },
    { focused: "#panel-name" },
    { press: ["#panel-done", "Enter"] },
    { absent: "#panel-name" },
    { focused: "#open" },
  ],
});
