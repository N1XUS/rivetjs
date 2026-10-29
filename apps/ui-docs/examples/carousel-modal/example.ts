import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Modal",
  summary: "A thumbnail grid opens a modal carousel at the pressed photo; previous / next sit outside the slides.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 640 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#carousel-modal-open-3" },
    { matches: "[role=dialog] #carousel-modal" },
    { expect: ["#carousel-modal [data-slot=carousel-counter]", "3 / 4"] },
    { click: "#carousel-modal [data-slot=carousel-next]" },
    { expect: ["#carousel-modal [data-slot=carousel-counter]", "4 / 4"] },
    { key: "Escape" },
    { absent: "[role=dialog]" },
  ],
});
