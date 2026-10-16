import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: grid",
  summary: "GridLayout fits as many columns of minItemSize tiles as the width allows (maxColumns caps them); rows of tiles are virtualized like list rows.",
  tags: ["virtualizer", "grid"],
  status: "experimental",
  frame: { height: 336, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    // Server window at 320px: three 98px columns (88px minimum, grown to fill), 8px gaps.
    { matches: '#photos [data-rv-view="2"]:is([style*="top:8px"], [style*="top: 8px"])' },
    { matches: '#photos [data-rv-view="3"]:is([style*="top:114px"], [style*="top: 114px"])' },
    { matches: '#photos [data-rv-view="3"]:is([style*="inset-inline-start:7px"], [style*="inset-inline-start: 7px"])' },
    { absent: '#photos [data-rv-view="60"]' },
    { press: ["#photos", "ArrowDown"] },
    { expect: ["#photos-top", "40"] },
    { click: "#photos-bottom" },
    { matches: '#photos [data-rv-view="599"]' },
    { absent: '#photos [data-rv-view="0"]' },
  ],
});
