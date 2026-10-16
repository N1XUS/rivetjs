import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollArea",
  summary: "A ScrollArea over a list of tags: native scrolling in the viewport, a custom vertical scrollbar whose thumb follows the scroll position.",
  tags: ["scroll-area", "scrollbar", "css"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#tags", "class", "ScrollAreaRoot"] },
    { matches: "#tags-viewport[data-rv-scroll-area-viewport]" },
    { expect: ["#tags-viewport", "v1.2.0-beta.50"] },
    { hover: "#tags-viewport" },
    { matches: '#tags-scrollbar[data-state="visible"][data-orientation="vertical"]' },
    { matches: "#tags-thumb" },
    { wheel: ["#tags-viewport", 400] },
    { matches: '#tags-thumb:not([style*="translate3d(0px, 0px"])' },
  ],
});
