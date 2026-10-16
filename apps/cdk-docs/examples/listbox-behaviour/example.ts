import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox behaviour on your own markup",
  summary: "createListState with listBoxProps, optionProps and the listBox<Event> handlers on a <ul>: horizontal arrows, Space toggles, clicks select.",
  tags: ["listbox", "behaviour"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#tags", "role", "listbox"] },
    { attr: ["#tags", "aria-multiselectable", "true"] },
    { attr: ["#tags-option-bug", "role", "option"] },
    // No focused key yet: the listbox is the tab stop.
    { attr: ["#tags", "tabindex", "0"] },
    { attr: ["#tags-option-bug", "tabindex", "-1"] },
    { press: ["#tags-option-bug", "Space"] },
    { expect: ["#tags-value", "Labels: bug"] },
    { key: "ArrowRight" },
    { focused: "#tags-option-docs" },
    // perf is disabled: skipped.
    { key: "ArrowRight" },
    { focused: "#tags-option-ui" },
    { key: "Space" },
    { expect: ["#tags-value", "Labels: bug, ui"] },
    { click: "#tags-option-docs" },
    { expect: ["#tags-value", "Labels: bug, docs, ui"] },
  ],
});
