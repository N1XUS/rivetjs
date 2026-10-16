import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Masonry: Feed with load more",
  summary:
    "Cards of unknown height are measured and placed on the client; onLoadMore appends a page when the end comes into view, renderLoader shows while isLoading.",
  tags: ["masonry", "card", "load-more"],
  status: "experimental",
  frame: { height: 560 },
  show: ["src/routes/index.tsx"],
  test: [{ attr: ["#masonry-feed", "role", "list"] }, { matches: '#masonry-feed .masonry__item[data-key="1"]' }],
});
