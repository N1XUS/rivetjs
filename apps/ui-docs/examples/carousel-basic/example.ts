import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Basic",
  summary: "Five slides with the overlay previous / next buttons, dot indicators and an N / M counter.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 260, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#carousel-basic-counter", "1 / 5"],
    },
    {
      click: "#carousel-basic-next",
    },
    {
      expect: ["#carousel-basic-counter", "2 / 5"],
    },
  ],
});
