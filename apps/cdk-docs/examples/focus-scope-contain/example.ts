import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FocusScope",
  summary: "An inline editor that keeps Tab and Shift+Tab inside it, so keyboard focus wraps instead of leaving.",
  tags: ["cdk", "focus", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-rv-focus-scope] #title" },
    // The first Tab on the resumed page runs while the scope's code loads: it must still land right.
    { press: ["#save", "Tab"] },
    { focused: "#cancel" },
    { key: "Tab" },
    { focused: "#title" },
    { key: "Shift+Tab" },
    { focused: "#cancel" },
    { key: "Shift+Tab" },
    { focused: "#save" },
    { key: "Shift+Tab" },
    { focused: "#title" },
    { key: "Shift+Tab" },
    { focused: "#cancel" },
    // Outside the scope, Tab is the browser's.
    { press: ["#before", "Tab"] },
    { focused: "#title" },
  ],
});
