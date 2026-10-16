import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FocusTrap",
  summary:
    "Angular CDK FocusTrap: hidden anchors around a region wrap Tab, cdk-focus-initial picks the first focus, enabled toggles, destroy removes the anchors.",
  tags: ["cdk", "a11y", "angular-cdk", "focus"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: ".cdk-focus-trap-anchor" },
    { click: "#trap" },
    { matches: "#region + .cdk-focus-trap-anchor" },
    { attr: [".cdk-focus-trap-anchor", "aria-hidden", "true"] },
    // focusInitialElement: the [cdkFocusInitial] field.
    { focused: "#city" },
    { key: "Tab" },
    { focused: "#ok" },
    // Tab reaches the end anchor: back to the first tabbable element.
    { key: "Tab" },
    { focused: "#street" },
    { key: "Shift+Tab" },
    { focused: "#ok" },
    { press: ["#ok", "Enter"] },
    { absent: ".cdk-focus-trap-anchor" },
  ],
});
