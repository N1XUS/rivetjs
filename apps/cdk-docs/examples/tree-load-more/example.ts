import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: loading more rows",
  summary: "A TreeLoadMoreItem at the end of a row's children calls onLoadMore when scrolled near; createAsyncList pages a fake loader.",
  tags: ["tree", "async", "infinite scroll"],
  status: "experimental",
  frame: { height: 256, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#species-pokemon", "aria-expanded", "true"] },
    { expect: ["#species-p1", "Pokemon 1"] },
    { absent: "#species-p21" },
    // Scrolling the tree brings the sentinel into view: the next page loads.
    { wheel: ["#species", 2000] },
    { expect: ["#species-p21", "Pokemon 21"] },
  ],
});
