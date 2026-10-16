import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Right to left",
  summary: 'embla\'s Right To Left example: direction="rtl" under dir="rtl" mirrors the track, the chevrons and the arrow keys.',
  tags: ["carousel", "rtl"],
  status: "experimental",
  frame: { height: 260, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-rtl-wrapper", "dir", "rtl"] },
    { click: "#carousel-rtl-next" },
    { attr: ["#carousel-rtl-slide-1", "data-snapped", "true"] },
    { press: ["#carousel-rtl-next", "ArrowLeft"] },
    { attr: ["#carousel-rtl-slide-2", "data-snapped", "true"] },
  ],
});
