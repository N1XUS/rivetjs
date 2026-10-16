import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Group focus state",
  summary: "A Group around an input and a button: data-focus-within while focus is inside, data-focus-visible only for keyboard focus.",
  tags: ["group", "focus"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#search", "role", "group"] },
    { attr: ["#search", "class", "rv-Group"] },
    { press: ["#g-before", "Tab"] },
    { focused: "#g-query" },
    { attr: ["#search", "data-focus-within", "true"] },
    { attr: ["#search", "data-focus-visible", "true"] },
    { click: "#g-before" },
    { attr: ["#search", "data-focus-within", null] },
    // Pointer focus: focus-within without the focus ring.
    { click: "#g-query" },
    { attr: ["#search", "data-focus-within", "true"] },
    { attr: ["#search", "data-focus-visible", null] },
  ],
});
