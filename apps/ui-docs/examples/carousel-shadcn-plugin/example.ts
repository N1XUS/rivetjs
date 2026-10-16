import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Carousel: shadcn plugin",
  summary: "shadcn/ui's Plugins demo: Autoplay every 2 s, stopped by an interaction; hovering pauses it (shadcn's onMouseEnter / onMouseLeave).",
  tags: ["carousel", "shadcn", "autoplay"],
  status: "experimental",
  frame: {
    height: "md",
  },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#carousel-shadcn-plugin", "data-ready", "true"] },
    { attr: ["#carousel-shadcn-plugin", "data-playing", "true"] },
    { click: "#carousel-shadcn-plugin-next" },
    { attr: ["#carousel-shadcn-plugin-slide-1", "data-snapped", "true"] },
    { attr: ["#carousel-shadcn-plugin", "data-playing", null] },
  ],
});
