import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: basic",
  summary: "A horizontal stepper with tabbed headers, panels and Back / Next buttons, styled with plain CSS on the rv-* classes.",
  tags: ["cdk", "stepper", "css"],
  status: "experimental",
  frame: { height: 194, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#checkout-label-0", "aria-selected", "true"] },
    { matches: "#checkout-content-1[hidden]" },
    { click: "#next-0" },
    { attr: ["#checkout-label-1", "aria-selected", "true"] },
    { expect: ["#checkout-content-1", "Where should we ship"] },
    { press: ["#checkout-label-1", "ArrowRight"] },
    { focused: "#checkout-label-2" },
    { key: "Enter" },
    { attr: ["#checkout-label-2", "aria-selected", "true"] },
    { click: "#back-2" },
    { attr: ["#checkout-label-1", "aria-selected", "true"] },
  ],
});
