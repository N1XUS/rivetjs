import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ConfigurableFocusTrap",
  summary: "ConfigurableFocusTrapFactory: the newest trap is the active one, and its inert strategy pulls focus back when a click moves it outside.",
  tags: ["cdk", "a11y", "angular-cdk", "focus"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#start" },
    { focused: "#one" },
    // A click outside moves focus out; the strategy brings it back.
    { click: "#outside" },
    { focused: "#one" },
    { click: "#stop" },
    { click: "#outside" },
    { focused: "#outside" },
  ],
});
