import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ViewportRuler",
  summary:
    "viewportRuler() reads the window viewport: getViewportSize(), getViewportScrollPosition() and getViewportRect(); change() emits (throttled) on resize and orientationchange.",
  tags: ["scrolling", "viewport ruler"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#ruler-size", "not measured"] },
    { click: "#ruler-measure" },
    { expect: ["#ruler-size", "×"] },
    { expect: ["#ruler-scroll", "top 0, left 0"] },
    { expect: ["#ruler-listening", "listening to change()"] },
    { click: "#ruler-scroll-page" },
    { expect: ["#ruler-scroll", "top 120, left 0"] },
    { expect: ["#ruler-rect", "top 120"] },
  ],
});
