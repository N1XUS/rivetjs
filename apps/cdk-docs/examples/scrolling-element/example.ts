import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: scrolling ancestor",
  summary:
    'scrollable: "element" lets an ancestor CdkVirtualScrollableElement scroll the list together with other content; the viewport measures its offset inside it.',
  tags: ["scrolling", "virtual scroll"],
  status: "experimental",
  frame: { height: "lg" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#feed-scroller", "class", "cdk-virtual-scrollable scroller"] },
    // The viewport does not scroll itself: no cdk-virtual-scrollable class on it.
    { matches: "#inner.cdk-virtual-scroll-viewport:not(.cdk-virtual-scrollable)" },
    { matches: '#inner .row[data-index="0"]' },
    { click: "#feed-jump" },
    { absent: '#inner .row[data-index="0"]' },
    { matches: '#inner .row[data-index="40"]' },
  ],
});
