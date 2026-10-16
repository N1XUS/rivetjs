import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel with thumbnails",
  summary: "A render-function child reads the carousel state: a row of thumbnail buttons calls carouselScrollTo and marks the selected one with aria-current.",
  tags: ["carousel", "render props", "tailwind"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#thumb-0", "aria-current", "true"] },
    { click: "#thumb-3" },
    { attr: ["#photos-slide-3", "data-snapped", "true"] },
    { attr: ["#thumb-3", "aria-current", "true"] },
    { attr: ["#thumb-0", "aria-current", null] },
  ],
});
