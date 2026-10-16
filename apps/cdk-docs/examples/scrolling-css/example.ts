import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: plain CSS",
  summary:
    "@rivetjs/cdk/scrolling.css plus plain rules on cdk-virtual-scroll-viewport, -content-wrapper and the orientation classes; the item size includes the row margin.",
  tags: ["scrolling", "css", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#css-vp.cdk-virtual-scroll-viewport.cdk-virtual-scrollable.cdk-virtual-scroll-orientation-vertical" },
    { matches: "#css-vp > .cdk-virtual-scroll-content-wrapper > .item" },
    { matches: "#css-vp > .cdk-virtual-scroll-spacer" },
    { press: ["#css-vp", "End"] },
    { expect: ["#css-vp .cdk-virtual-scroll-content-wrapper", "Card 499"] },
  ],
});
