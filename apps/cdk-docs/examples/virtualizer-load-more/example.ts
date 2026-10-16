import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Virtualizer: load more",
  summary: "onLoadMore runs when the scroll position comes within loadMoreOffset viewports of the end; isLoading reserves a loader view after the rows.",
  tags: ["virtualizer", "infinite scroll", "events"],
  status: "experimental",
  frame: { height: 391, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#feed-count", "40 items"] },
    { press: ["#feed", "ArrowDown"] },
    { expect: ["#feed-top", "scrollTop: 40"] },
    { click: "#feed-bottom" },
    // Near the end: onLoadMore sets isLoading (the loader view appears), then 40 more rows arrive.
    { matches: '#feed [data-rv-type="loader"] .loader:not([hidden])' },
    { expect: ["#feed-count", "80 items"] },
    { expect: ["#feed-calls", "onLoadMore calls: 1"] },
    { matches: '#feed [data-rv-type="loader"] .loader[hidden]' },
    { click: "#feed-bottom" },
    { expect: ["#feed-count", "120 items"] },
    { matches: '#feed [data-rv-view="item-79"]' },
  ],
});
