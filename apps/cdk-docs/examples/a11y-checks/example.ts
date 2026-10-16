import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Focusable and tabbable checks",
  summary:
    "isVisible, isFocusable, isTabbable and tabbables() from @rivetjs/cdk/a11y on a disabled button, a tabindex -1 element, a hidden input and a radio group.",
  tags: ["cdk", "a11y", "focus"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#run" },
    { expect: ["#tabbables", "tabbables: ok, r2, link, run"] },
    { expect: ["#r-off", "off: visible"] },
    { expect: ["#r-minus", "minus: visible focusable"] },
    { expect: ["#r-r1", "r1: visible focusable"] },
    { expect: ["#r-r2", "r2: visible focusable tabbable"] },
  ],
});
