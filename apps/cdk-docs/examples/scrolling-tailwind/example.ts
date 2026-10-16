import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: Tailwind",
  summary:
    "Tailwind classes on the viewport (class is appended to the cdk-virtual-scroll-* classes) and on rows, with zebra stripes from the row context (odd / first / last).",
  tags: ["scrolling", "tailwind", "styling"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#tw-vp.cdk-virtual-scroll-viewport.cdk-virtual-scrollable.rounded-xl" },
    { attr: ['#tw-vp [data-index="0"]', "data-first", "true"] },
    { attr: ['#tw-vp [data-index="1"]', "data-odd", "true"] },
    { press: ["#tw-vp", "End"] },
    { attr: ['#tw-vp [data-index="999"]', "data-last", "true"] },
  ],
});
