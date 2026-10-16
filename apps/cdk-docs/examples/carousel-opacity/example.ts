import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel opacity tween",
  summary: "embla's Opacity example: onApi listens to scroll and fades each slide by its distance to the selected snap; loop wraps the tween.",
  tags: ["carousel", "tween", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#opacity", "data-ready", "true"] },
    { matches: '#opacity-slide-0[style*="opacity: 1"]' },
    { click: "#next" },
    { attr: ["#opacity-slide-1", "data-snapped", "true"] },
    { matches: '#opacity-slide-1:is([style*="opacity: 1"], [style*="opacity: 0.99"])' },
  ],
});
