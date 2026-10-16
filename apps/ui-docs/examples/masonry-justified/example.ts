import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: Justified",
  summary:
    'Rivet addition: `layout="justified"` rows (Flickr / Google Photos) from `?image` sizes, laid out by the server; every row fills the width and the last row is flush (`lastRow="fill"`). `masonrySizes` picks the srcset width.',
  tags: ["masonry", "justified", "image"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#masonry-justified", "role", "grid"] }, { matches: '.masonry[data-layout="justified"] .masonry__item[data-key="cover-dune"]' }],
});
