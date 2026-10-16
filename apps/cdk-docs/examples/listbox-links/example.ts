import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox links",
  summary: "Items with href render as links (role=option); with selectionMode none they navigate, with replace behaviour a press selects and Enter follows.",
  tags: ["listbox", "links"],
  status: "experimental",
  frame: { height: 186, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "a#nav-option-intro[href='#intro'][role=option]" },
    { attr: ["#nav-option-intro", "aria-selected", null] },
    { attr: ["#nav-option-api", "target", "_self"] },
    { press: ["#nav-option-intro", "ArrowDown"] },
    { focused: "#nav-option-install" },
    // replace + links: a click selects instead of navigating (linkBehavior "action").
    { click: "#pick-option-install" },
    { expect: ["#pick-value", "Selected: install"] },
    { attr: ["#pick-option-install", "aria-selected", "true"] },
  ],
});
