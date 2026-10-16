import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: image mosaic + lightbox",
  summary:
    "Known image sizes are placed on the server (inline CSS, no layout shift, nothing runs at load); a click or Enter on a tile opens the cdk Lightbox at that photo. Arrow keys move by visual position.",
  tags: ["masonry", "grid", "image", "lightbox", "tailwind"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#mosaic", "role", "grid"] },
    { matches: '#mosaic [data-rv-item][data-key="cherries-0"][style*="aspect-ratio"]' },
    { click: '#mosaic [data-key="cactus-0"]' },
    { matches: "[data-lightbox-root] [data-lightbox-slide][data-current]" },
  ],
});
