import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: plain CSS",
  summary: "Plain CSS on the default rv-Tree / rv-TreeItem classes, the data attributes and the --tree-item-level custom property.",
  tags: ["tree", "styling", "css"],
  status: "experimental",
  frame: { height: 190, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#css-tree.rv-Tree" },
    { matches: "#css-tree-inbox.rv-TreeItem[data-expanded][data-has-child-items]" },
    { attr: ["#css-tree-inbox", "style", "--tree-item-level:1"] },
    { attr: ["#css-tree-work", "style", "--tree-item-level:2"] },
    { click: "#css-tree-work" },
    { attr: ["#css-tree-work", "data-selected", "true"] },
    { press: ["#css-tree-work", "ArrowDown"] },
    { focused: "#css-tree-family" },
    { key: "Enter" },
    { attr: ["#css-tree-family", "data-selected", "true"] },
    { attr: ["#css-tree-work", "data-selected", null] },
  ],
});
