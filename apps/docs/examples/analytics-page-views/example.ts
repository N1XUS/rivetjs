import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Analytics page views",
  summary: "Send a page view at idle time from the root layout, with the analytics code in its own chunk.",
  tags: ["client-effect", "layouts", "loading-code"],
  frame: { height: "sm" },
  show: ["src/components/PageViews.tsx", "src/routes/_layout.tsx", "src/analytics.ts"],
  test: [{ expect: ["#views", "Page views sent: 1 (/examples/analytics-page-views/frame"] }],
});
