import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FloatingToc: Press Mode In Page",
  summary: 'triggerMode="press" in a scrolling page: press the bars to open the list, an item scrolls to its section and the bars follow the scroll.',
  tags: ["floating-toc"],
  status: "experimental",
  frame: { height: 480 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      click: "#toc-press-page-trigger",
    },
    {
      click: "#toc-press-page-faq",
    },
    {
      absent: "#toc-press-page-faq",
    },
    // The page scrolled: the observer moved the active bar off the first section.
    {
      attr: ["#toc-press-page-trigger [data-slot=floating-toc-bar]:first-child", "data-active", null],
    },
  ],
});
