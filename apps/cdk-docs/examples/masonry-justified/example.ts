import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: justified rows",
  summary:
    'Flickr / Google Photos rows: `layout="justified"` packs photos into rows that fill the width exactly (flickr/justified-layout), from the known image sizes on the server. The last row fills too (`lastRow="fill"`), so the bottom edge is flush.',
  tags: ["masonry", "justified", "image", "tailwind"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#rows", "role", "grid"] },
    { matches: '.rv-Masonry[data-layout="justified"]' },
    { matches: '#rows [data-rv-item][data-key="cherries-0"][style*="aspect-ratio"]' },
  ],
});
