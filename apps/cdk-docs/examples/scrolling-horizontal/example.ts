import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtual scroll: horizontal and RTL",
  summary:
    'orientation horizontal virtualizes along x; inside dir="rtl" the content is translated from the right and scrollToOffset measures from the start edge.',
  tags: ["scrolling", "virtual scroll", "horizontal", "rtl"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#ltr-strip.cdk-virtual-scroll-orientation-horizontal" },
    { matches: '#ltr-strip .cdk-virtual-scroll-spacer:is([style*="width:50000px"], [style*="width: 50000px"])' },
    { click: "#ltr-go" },
    // Item 20 is first visible; the 100px minimum buffer keeps two items before it.
    { expect: ["#ltr-strip .col", "18"] },
    { matches: '#ltr-strip .cdk-virtual-scroll-content-wrapper[style*="translateX(900px)"]' },
    { click: "#rtl-go" },
    { expect: ["#rtl-strip .col", "18"] },
    { matches: '#rtl-strip .cdk-virtual-scroll-content-wrapper[style*="translateX(-900px)"]' },
  ],
});
