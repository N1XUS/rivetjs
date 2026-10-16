import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ListBox selectionBehavior",
  summary: "toggle: every press adds or removes. replace: a press replaces the selection, arrows move it, Ctrl/Cmd adds, double click and Enter run onAction.",
  tags: ["listbox", "selection"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    // toggle: each click adds or removes.
    { click: "#toggle-option-notes" },
    { click: "#toggle-option-report" },
    { expect: ["#toggle-value", "notes, report"] },
    // Space toggles the focused option.
    { press: ["#toggle-option-report", "Space"] },
    { expect: ["#toggle-value", "notes"] },
    // replace: a click replaces, the selection follows the arrow keys.
    { click: "#replace-option-notes" },
    { expect: ["#replace-value", "notes"] },
    { click: "#replace-option-photo" },
    { expect: ["#replace-value", "photo"] },
    { key: "ArrowDown" },
    { expect: ["#replace-value", "report"] },
    // Shift+arrow extends from the anchor.
    { key: "Shift+ArrowDown" },
    { expect: ["#replace-value", "report, slides"] },
    // Enter runs the action of the focused option.
    { key: "Enter" },
    { expect: ["#opened", "Opened: slides"] },
  ],
});
