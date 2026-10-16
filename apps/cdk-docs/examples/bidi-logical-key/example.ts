import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "logicalKey()",
  summary: "One key handler for both directions: logicalKey swaps ArrowLeft and ArrowRight when direction() of the toolbar is rtl.",
  tags: ["cdk", "bidi", "keyboard"],
  status: "experimental",
  frame: { height: 104, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { press: ["#ltr-0", "ArrowRight"] },
    { focused: "#ltr-1" },
    { key: "ArrowLeft" },
    { focused: "#ltr-0" },
    { press: ["#rtl-0", "ArrowLeft"] },
    { focused: "#rtl-1" },
    { key: "ArrowLeft" },
    { focused: "#rtl-2" },
    { key: "ArrowRight" },
    { focused: "#rtl-1" },
  ],
});
