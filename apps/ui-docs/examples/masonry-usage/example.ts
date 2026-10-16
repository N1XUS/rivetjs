import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: Usage",
  summary:
    "Rivet addition: a photo wall. Known image sizes are placed by the server (no layout shift, nothing runs at load); columns follow the container width.",
  tags: ["masonry", "image", "grid"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#masonry-usage", "role", "grid"] }, { matches: '#masonry-usage .masonry__item[data-key="cover-dune"]' }],
});
