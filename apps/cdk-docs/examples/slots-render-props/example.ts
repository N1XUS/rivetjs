import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Slots: render props",
  summary: "Input's class and style accept functions of its render props (accessors such as isFocused() and isHovered()), evaluated in bindings.",
  tags: ["slots", "render-props", "input"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#rp-input", "class", "rv-Input field"] },
    { click: "#rp-input" },
    { attr: ["#rp-input", "class", "rv-Input field field--focused"] },
    { attr: ["#rp-input", "data-focused", "true"] },
  ],
});
