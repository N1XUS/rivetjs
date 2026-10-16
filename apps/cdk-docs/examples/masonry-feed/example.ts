import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: cards feed with load more",
  summary:
    "Cards of unknown height: CSS columns paint first, then a ResizeObserver places them by their measured heights (batched reads, then writes). onLoadMore appends a page when the end scrolls into view; renderLoader shows while isLoading.",
  tags: ["masonry", "feed", "load-more", "measure", "tailwind"],
  status: "experimental",
  frame: { height: 520 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#feed", "role", "list"] }, { matches: '#feed [data-rv-item][data-key="1"]' }],
});
