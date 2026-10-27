import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: Size units",
  summary:
    'Pixel and rem sizes ("240px", "12rem") next to percentages; `groupResizeBehavior="preserve-pixel-size"` keeps the sidebar width when the group resizes.',
  tags: ["resizable"],
  status: "experimental",
  frame: { height: 260, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "[data-slot=resizable-panel][style*='flex-basis: 240px'], [data-slot=resizable-panel][style*='flex-basis:240px']" },
    { press: ["#units-handle", "ArrowRight"] },
    { attr: ["#units-handle", "data-separator", "focus"] },
  ],
});
