import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: 10 000 virtualized tiles",
  summary: "virtualize: the cdk Virtualizer with a masonry WaterfallLayout renders only the tiles in view; keys and selection reach tiles outside the window.",
  tags: ["masonry", "virtualization", "grid", "tailwind"],
  status: "experimental",
  frame: { height: 470 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#many", "aria-rowcount", "10000"] }, { matches: '#many [data-rv-item][data-key="0"]' }],
});
