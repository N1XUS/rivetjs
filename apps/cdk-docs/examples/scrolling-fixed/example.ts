import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: fixed size items",
  summary:
    "CdkVirtualScrollViewport with the fixed-size strategy: 10,000 rows of 40px, the rendered range plus buffer in the DOM, scrolledIndexChange as a callback.",
  tags: ["scrolling", "virtual scroll"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Server range: a 240px viewport plus the 200px max buffer = 11 rows.
    { matches: '#fixed .row[data-index="0"]' },
    { matches: '#fixed .row[data-index="10"]' },
    { absent: '#fixed .row[data-index="11"]' },
    { matches: '#fixed .cdk-virtual-scroll-spacer[style*="height:400000px"], #fixed .cdk-virtual-scroll-spacer[style*="height: 400000px"]' },
    { attr: ['#fixed .row[data-index="1"]', "data-odd", "true"] },
    { press: ["#fixed", "End"] },
    { expect: ["#fixed-index", "9994"] },
    { matches: '#fixed .row[data-index="9999"]' },
    { absent: '#fixed .row[data-index="0"]' },
    { press: ["#fixed", "Home"] },
    { expect: ["#fixed-index", "First visible: 0"] },
    { matches: '#fixed .row[data-index="0"]' },
  ],
});
