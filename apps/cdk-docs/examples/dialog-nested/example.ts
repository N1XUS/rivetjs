import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Nested dialogs",
  summary:
    "A DialogTrigger inside a dialog (function children): only the top-most modal reacts to Escape, focus returns to the nested trigger, then to the first.",
  tags: ["dialog", "modal", "composition"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#outer-trigger" },
    { matches: "#outer" },
    { focused: "#outer" },
    { key: "Tab" },
    { focused: "#inner-trigger" },
    { key: "Enter" },
    { matches: "#inner" },
    { focused: "#inner" },
    // The outer dialog is inert while the inner one is open.
    { matches: "#outer[inert], [inert] #outer" },
    { key: "Escape" },
    { absent: "#inner" },
    { matches: "#outer" },
    { focused: "#inner-trigger" },
    { key: "Escape" },
    { absent: "#outer" },
    { focused: "#outer-trigger" },
  ],
});
