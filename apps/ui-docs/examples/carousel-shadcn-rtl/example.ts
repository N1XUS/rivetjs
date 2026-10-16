import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: shadcn RTL",
  summary: 'shadcn/ui\'s RTL demo: direction="rtl" under dir="rtl" with Arabic numerals; the track, the buttons and the arrow keys mirror.',
  tags: ["carousel", "shadcn", "rtl"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-shadcn-rtl-wrapper", "dir", "rtl"] },
    { expect: ["#carousel-shadcn-rtl-slide-0", "١"] },
    { click: "#carousel-shadcn-rtl-next" },
    { attr: ["#carousel-shadcn-rtl-slide-1", "data-snapped", "true"] },
  ],
});
