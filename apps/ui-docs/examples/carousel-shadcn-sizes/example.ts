import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: shadcn sizes",
  summary: "shadcn/ui's Sizes demo: align start with one card per view, two from md and three from lg (--rv-carousel-slide-size per breakpoint).",
  tags: ["carousel", "shadcn", "responsive"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-shadcn-sizes-slide-0", "data-snapped", "true"] },
    { click: "#carousel-shadcn-sizes-next" },
    { attr: ["#carousel-shadcn-sizes-slide-1", "data-snapped", "true"] },
  ],
});
