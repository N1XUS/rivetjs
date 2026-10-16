import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel scale tween",
  summary: "embla's Scale example: onApi listens to scroll and scales each slide's content by its distance to the selected snap (loop).",
  tags: ["carousel", "tween", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#scale", "data-ready", "true"] },
    { matches: '#scale-slide-0 .tween[style*="scale(1)"]' },
    { click: "#next" },
    { attr: ["#scale-slide-1", "data-snapped", "true"] },
    { matches: '#scale-slide-1 .tween:is([style*="scale(1)"], [style*="scale(0.99"])' },
  ],
});
