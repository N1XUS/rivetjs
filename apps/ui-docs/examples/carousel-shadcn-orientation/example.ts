import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: shadcn orientation",
  summary: 'shadcn/ui\'s Orientation demo: a vertical carousel (orientation="vertical", 200px track, two cards per view from md).',
  tags: ["carousel", "shadcn", "vertical"],
  status: "experimental",
  frame: {
    height: "lg",
  },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-shadcn-orientation", "data-orientation", "vertical"] },
    { attr: ["#carousel-shadcn-orientation-slide-0", "data-snapped", "true"] },
    { click: "#carousel-shadcn-orientation-next" },
    { attr: ["#carousel-shadcn-orientation-slide-1", "data-snapped", "true"] },
  ],
});
