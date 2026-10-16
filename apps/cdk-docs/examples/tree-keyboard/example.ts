import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: tab navigation",
  summary: "keyboardNavigationBehavior tab: Tab moves into a row's text field, where arrows, Space and letters edit the text instead of navigating.",
  tags: ["tree", "keyboard", "text field"],
  status: "experimental",
  frame: { height: 256, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#shared-documents", "aria-expanded", "true"] },
    { press: ["#shared-documents", "ArrowDown"] },
    { focused: "#shared-weekly" },
    { key: "Tab" },
    { focused: "#shared-weekly-name" },
    // Arrow keys and typing stay in the field.
    { key: "ArrowUp" },
    { focused: "#shared-weekly-name" },
    { key: "x" },
    { expect: ["#shared-edited", "Edited: xWeekly Report.pdf"] },
    // Space types a space instead of selecting the row.
    { key: "Space" },
    { expect: ["#shared-edited", "Edited: x Weekly Report.pdf"] },
    { attr: ["#shared-weekly", "aria-selected", "false"] },
  ],
});
