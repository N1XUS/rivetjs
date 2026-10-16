import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox disabled options",
  summary:
    'Disabled items (item.disabled, disabledKeys): skipped by arrow keys and not selectable; disabledBehavior="selection" keeps them focusable but unselectable.',
  tags: ["listbox", "disabled"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#all-option-a2", "aria-disabled", "true"] },
    { attr: ["#all-option-a2", "data-disabled", "true"] },
    { attr: ["#all-option-a4", "aria-disabled", "true"] },
    { attr: ["#all-option-a4", "tabindex", null] },
    // Arrow keys skip disabled options.
    { press: ["#all-option-a1", "ArrowDown"] },
    { focused: "#all-option-a3" },
    { key: "ArrowDown" },
    { focused: "#all-option-a5" },
    // Select all leaves disabled options out.
    { key: "ControlOrMeta+a" },
    { attr: ["#all-option-a4", "aria-selected", "false"] },
    { attr: ["#all-option-a5", "aria-selected", "true"] },
    // disabledBehavior="selection": a disabledKeys option is focusable, never selectable.
    { attr: ["#selection-option-a4", "aria-disabled", null] },
    { attr: ["#selection-option-a2", "aria-disabled", null] },
    { press: ["#selection-option-a3", "ArrowDown"] },
    { focused: "#selection-option-a4" },
    { key: "Space" },
    { attr: ["#selection-option-a4", "aria-selected", "false"] },
    { expect: ["#selection-value", "none"] },
    { key: "ArrowDown" },
    { key: "Space" },
    { expect: ["#selection-value", "a5"] },
  ],
});
