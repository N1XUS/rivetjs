import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList: dynamic items",
  summary:
    "items and selection from createListData in a grid layout: append a card, remove the selected cards or one card from its own button; arrows follow rows and columns.",
  tags: ["grid-list", "collections", "data"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#photos", "data-layout", "grid"] },
    { expect: ["#photos-leaf", "A Ficus Lyrata Leaf"] },
    { click: "#photos-add" },
    { expect: ["#photos-new-1", "New photo 1"] },
    { click: "#photos-beach" },
    { click: "#photos-new-1" },
    { attr: ["#photos-new-1", "aria-selected", "true"] },
    { click: "#photos-remove" },
    { absent: "#photos-beach" },
    { absent: "#photos-new-1" },
    // Grid layout: arrows follow the rendered rows and columns.
    { press: ["#photos-leaf", "ArrowRight"] },
    { focused: "#photos-road" },
    { click: "#photos-add" },
    { press: ["#photos-leaf", "ArrowDown"] },
    { focused: "#photos-new-2" },
    // Grid layout = keyboardNavigationBehavior "tab": Tab from a focused card moves to its own button.
    { press: ["#photos-leaf", "ArrowRight"] },
    { focused: "#photos-road" },
    { key: "Tab" },
    { focused: "#photos-road button" },
    { click: "#photos-road button" },
    { absent: "#photos-road" },
    { expect: ["#photos-leaf", "A Ficus Lyrata Leaf"] },
  ],
});
