import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: horizontal and RTL",
  summary:
    'ListLayout with orientation horizontal and scrollDirection horizontal; dir="rtl" positions views from the right and normalizes the browser\'s negative scrollLeft.',
  tags: ["virtualizer", "horizontal", "rtl"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Keys are the items (days 1..1000). LTR: 64px columns from the left; RTL: the same columns from the right.
    { matches: '#ltr [data-rv-view="3"]:is([style*="left:128px"], [style*="left: 128px"])' },
    { matches: '#rtl [data-rv-view="3"]:is([style*="right:128px"], [style*="right: 128px"])' },
    { absent: '#ltr [data-rv-view="31"]' },
    // Arrow keys scroll the focused scroller (the first scroll starts the engine).
    { press: ["#ltr", "ArrowRight"] },
    { expect: ["#ltr-left", "40"] },
    { click: "#ltr-far" },
    { matches: '#ltr [data-rv-view="31"][style*="left: 1920px"]' },
    { absent: '#ltr [data-rv-view="1"]' },
    // RTL: scrolling towards the end is a negative scrollLeft in Chromium; the engine normalizes it.
    { press: ["#rtl", "ArrowLeft"] },
    { expect: ["#rtl-left", "-40"] },
    { click: "#rtl-far" },
    { matches: '#rtl [data-rv-view="31"][style*="right: 1920px"]' },
    { absent: '#rtl [data-rv-view="1"]' },
  ],
});
