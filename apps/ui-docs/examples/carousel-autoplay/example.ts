import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Autoplay",
  summary: "Autoplay advances every 3 s, pauses on hover and focus, and the rotation control stops / starts it (W3C APG auto-rotating carousel).",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 260, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      name: ["#carousel-autoplay-rotation", "Stop automatic slide show"],
    },
    {
      click: "#carousel-autoplay-rotation",
    },
    {
      name: ["#carousel-autoplay-rotation", "Start automatic slide show"],
    },
  ],
});
