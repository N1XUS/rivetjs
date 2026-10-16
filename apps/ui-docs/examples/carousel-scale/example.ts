import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Scale",
  summary: "embla's Scale example on the ui Carousel: onApi listens to scroll and scales each slide's content by its distance to the selected snap.",
  tags: ["carousel", "tween"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-scale", "data-ready", "true"] },
    { matches: '#carousel-scale-slide-0 .tween[style*="scale(1)"]' },
    { click: "#carousel-scale-next" },
    { matches: '#carousel-scale-slide-1 .tween:is([style*="scale(1)"], [style*="scale(0.99"])' },
  ],
});
