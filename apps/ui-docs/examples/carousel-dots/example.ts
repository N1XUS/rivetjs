import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: Dots",
  summary: "The dots are a W3C APG tab list: arrow keys move between them and select their slide.",
  tags: ["carousel"],
  status: "experimental",
  frame: { height: 260, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      press: ["#carousel-dots [role=tab]:first-child", "ArrowRight"],
    },
    {
      attr: ["#carousel-dots [role=tab]:nth-child(2)", "aria-selected", "true"],
    },
  ],
});
