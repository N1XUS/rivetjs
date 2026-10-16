import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList: layouts",
  summary:
    'layout="grid": arrows follow the rendered rows and columns; layout="grid" orientation="horizontal": a scrolling strip where left / right move between items.',
  tags: ["grid-list", "layout", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#grid-photos", "data-layout", "grid"] },
    { attr: ["#strip", "data-orientation", "horizontal"] },
    { press: ["#grid-photos-sunset", "ArrowDown"] },
    { focused: "#grid-photos-sunrise" },
    { key: "ArrowRight" },
    { focused: "#grid-photos-giraffe" },
    { key: "ArrowUp" },
    { focused: "#grid-photos-trail" },
    { press: ["#strip-sunset", "ArrowRight"] },
    { focused: "#strip-trail" },
    { key: "End" },
    { focused: "#strip-golden" },
    { key: "Space" },
    { attr: ["#strip-golden", "aria-selected", "true"] },
  ],
});
