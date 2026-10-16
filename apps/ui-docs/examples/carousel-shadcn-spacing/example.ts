import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: shadcn spacing",
  summary: "shadcn/ui's Spacing demo: a tighter gap between the cards (--carousel-gap: 0.25rem), two from md and three from lg.",
  tags: ["carousel", "shadcn", "responsive"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-shadcn-spacing-slide-0", "data-snapped", "true"] },
    { click: "#carousel-shadcn-spacing-next" },
    { attr: ["#carousel-shadcn-spacing-slide-1", "data-snapped", "true"] },
  ],
});
