import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "InteractivityChecker",
  summary: "InteractivityChecker answers isDisabled, isVisible, isFocusable and isTabbable for a few kinds of element.",
  tags: ["cdk", "a11y", "angular-cdk"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#check" },
    { expect: ["#r-plain", "focusable tabbable visible"] },
    { expect: ["#r-disabled", "disabled visible"] },
    { expect: ["#r-minus", "focusable visible"] },
    { expect: ["#r-hidden", "none"] },
    { expect: ["#r-div", "visible"] },
  ],
});
