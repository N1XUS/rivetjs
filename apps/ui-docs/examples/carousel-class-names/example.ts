import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Class names",
  summary: "embla's Class Names example on the ui Carousel: the ClassNames plugin adds is-snapped to the selected slide; CSS dims the others.",
  tags: ["carousel", "plugin"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#carousel-class-names-slide-0.is-snapped" },
    { click: "#carousel-class-names-next" },
    { matches: "#carousel-class-names-slide-1.is-snapped" },
    { absent: "#carousel-class-names-slide-0.is-snapped" },
    { click: "#carousel-class-names-prev" },
    { matches: "#carousel-class-names-slide-0.is-snapped" },
  ],
});
