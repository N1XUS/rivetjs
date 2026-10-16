import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Opacity",
  summary: "embla's Opacity example on the ui Carousel: onApi listens to scroll and fades each slide by its distance to the selected snap (loop).",
  tags: ["carousel", "tween"],
  status: "experimental",
  frame: { height: 324, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-opacity", "data-ready", "true"] },
    { matches: '#carousel-opacity-slide-0[style*="opacity: 1"]' },
    { click: "#carousel-opacity-next" },
    { attr: ["#carousel-opacity-slide-1", "data-snapped", "true"] },
    { matches: '#carousel-opacity-slide-1:is([style*="opacity: 1"], [style*="opacity: 0.99"])' },
  ],
});
