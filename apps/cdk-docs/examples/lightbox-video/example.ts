import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Lightbox video slides",
  summary: "A native video slide autoplays when it becomes the current slide and pauses when you move away; image slides sit beside it.",
  tags: ["lightbox", "tailwind", "video"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#open" },
    { matches: "[data-lightbox-slide][data-current] video[data-autoplay]" },
    { key: "ArrowRight" },
    { matches: "[data-lightbox-slide][data-current] img" },
  ],
});
