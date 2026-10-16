import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ScrollArea: Tailwind",
  summary:
    "Both scrollbars and the corner with type=always, styled with Tailwind data-orientation variants; the thumbs size from the --rv-scroll-area-* variables.",
  tags: ["scroll-area", "tailwind", "corner", "horizontal"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#grid-thumb-y" },
    { matches: "#grid-thumb-x" },
    { matches: "#grid-corner" },
    { drag: ["#grid-thumb-y", "#grid-corner"] },
    { matches: '#grid-thumb-y:not([style*="translate3d(0px, 0px"])' },
    { wheel: ["#grid-scrollbar-y", -2000] },
    { matches: '#grid-thumb-y[style*="translate3d(0px, 0px"]' },
  ],
});
