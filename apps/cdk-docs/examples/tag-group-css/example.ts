import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup with plain CSS",
  summary: "No Tailwind: a stylesheet over rv-TagGroup, rv-TagList and rv-Tag with [aria-selected], [data-focus-visible], [data-hovered] and [data-disabled].",
  tags: ["tag-group", "css", "styling"],
  status: "experimental",
  frame: { height: 106, auto: true },
  show: ["src/styles.css", "src/routes/index.tsx"],
  test: [
    { matches: "#sizes.rv-TagGroup > .rv-TagList[role=grid]" },
    { matches: "#sizes .rv-Tag[data-key=m][aria-selected=true]" },
    { matches: "#sizes .rv-Tag[data-key=xl][data-disabled]" },
    { attr: ["#sizes [role=grid]", "aria-multiselectable", null] },
    { click: "#sizes [data-key=l]" },
    { attr: ["#sizes [data-key=l]", "aria-selected", "true"] },
    { attr: ["#sizes [data-key=m]", "aria-selected", "false"] },
    { key: "ArrowLeft" },
    { attr: ["#sizes [data-key=m]", "data-focus-visible", "true"] },
  ],
});
