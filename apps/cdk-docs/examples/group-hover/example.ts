import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Group hover events",
  summary: "onHoverStart, onHoverEnd and onHoverChange on a Group; the group also writes data-hovered.",
  tags: ["group", "hover", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#gh-zoom-in" },
    { attr: ["#zoom", "data-hovered", "true"] },
    { expect: ["#gh-log", "start:mouse"] },
    { expect: ["#gh-log", "hover:true"] },
    { click: "#gh-outside" },
    { attr: ["#zoom", "data-hovered", null] },
    { expect: ["#gh-log", "end:mouse"] },
    { expect: ["#gh-log", "hover:false"] },
  ],
});
