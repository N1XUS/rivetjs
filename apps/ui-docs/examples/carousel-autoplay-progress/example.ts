import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Autoplay progress",
  summary: "embla's Autoplay example on the ui Carousel: Start / Stop the rotation; a progress bar runs for each delay (autoplay:timerset).",
  tags: ["carousel", "autoplay"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#carousel-autoplay-progress", "data-ready", "true"] },
    { name: ["#carousel-autoplay-progress-play", "Start autoplay"] },
    { attr: ["#carousel-autoplay-progress-bar", "data-hidden", "true"] },
    { click: "#carousel-autoplay-progress-play" },
    { name: ["#carousel-autoplay-progress-play", "Stop autoplay"] },
    { expect: ["#carousel-autoplay-progress-play", "Stop"] },
  ],
});
