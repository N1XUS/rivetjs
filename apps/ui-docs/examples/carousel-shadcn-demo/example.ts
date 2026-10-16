import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: shadcn demo",
  summary: "shadcn/ui's Carousel demo on the ui Carousel: five square cards with the previous / next buttons outside the track.",
  tags: ["carousel", "shadcn"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-shadcn-demo-slide-0", "data-snapped", "true"] },
    { attr: ["#carousel-shadcn-demo-prev", "data-disabled", "true"] },
    { click: "#carousel-shadcn-demo-next" },
    { attr: ["#carousel-shadcn-demo-slide-1", "data-snapped", "true"] },
  ],
});
