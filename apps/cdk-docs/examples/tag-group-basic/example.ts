import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup",
  summary: "A labelled tag group with multiple selection: one tab stop, arrow keys move between tags, Space and clicks toggle.",
  tags: ["tag-group", "selection", "keyboard"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#categories > [role=grid][aria-multiselectable=true]" },
    { name: ["#categories [role=grid]", "Categories"] },
    { described: ["#categories [role=grid]", "Pick the topics you follow."] },
    { attr: ["#categories [data-key=news]", "role", "row"] },
    { attr: ["#categories [data-key=news]", "aria-selected", "false"] },
    { matches: "#categories [data-key=news] > [role=gridcell]" },
    { click: "#categories [data-key=travel]" },
    { attr: ["#categories [data-key=travel]", "aria-selected", "true"] },
    { attr: ["#categories [data-key=travel]", "data-selected", "true"] },
    { key: "ArrowRight" },
    { focused: "#categories [data-key=gaming]" },
    { key: "Space" },
    { attr: ["#categories [data-key=gaming]", "aria-selected", "true"] },
    // Focus wraps (useTagGroup: shouldFocusWrap).
    { key: "ArrowRight" },
    { key: "ArrowRight" },
    { focused: "#categories [data-key=news]" },
    { key: "End" },
    { focused: "#categories [data-key=shopping]" },
    { click: "#categories [data-key=travel]" },
    { attr: ["#categories [data-key=travel]", "aria-selected", "false"] },
  ],
});
