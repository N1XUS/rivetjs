import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Scroll progress",
  summary: "embla's Progress example on the ui Carousel: a bar follows embla's scrollProgress (state.scrollProgress) while you drag freely.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 262, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: '#carousel-progress-bar[style*="translate3d(0%"]' },
    { click: "#carousel-progress-next" },
    { absent: '#carousel-progress-bar[style*="translate3d(0%"]' },
  ],
});
