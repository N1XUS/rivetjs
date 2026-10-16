import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Several slides per view",
  summary:
    "--rv-carousel-slide-size sets the slide width (here a third of the viewport); align start, slidesToScroll 3 and containScroll keep the last page full.",
  tags: ["carousel", "tailwind", "slidesToScroll"],
  status: "experimental",
  frame: { height: 192, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#cards-slide-0", "aria-label", "1 of 9"] },
    { attr: ["#cards-slide-2", "data-snapped", "true"] },
    { attr: ["#cards-slide-3", "data-snapped", null] },
    { click: "#next" },
    { attr: ["#cards-slide-3", "data-snapped", "true"] },
    { attr: ["#cards-slide-5", "data-snapped", "true"] },
  ],
});
