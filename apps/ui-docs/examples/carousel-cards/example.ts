import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: With cards",
  summary: "Card slides at 80% so the next card peeks in; previous / next as secondary buttons outside.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 333, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: '[data-slot="carousel-item"] [data-slot="card"]',
    },
    {
      click: "#carousel-cards-next",
    },
    {
      absent: "#carousel-cards-prev[disabled]",
    },
  ],
});
