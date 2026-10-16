import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList: selection and actions",
  summary: "selectedKeys signals and onAction with toggle and replace selection behavior; a disabled row is skipped and cannot be selected.",
  tags: ["grid-list", "selection", "actions"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#toggle-trail", "aria-disabled", "true"] },
    // toggle + onAction, nothing selected: a press is the action.
    { click: "#toggle-lion" },
    { expect: ["#nature-action", "Last action: toggle lion"] },
    { expect: ["#toggle-selected", "Selected: none"] },
    // Space selects; once something is selected, presses toggle.
    { key: "Space" },
    { expect: ["#toggle-selected", "Selected: lion"] },
    { click: "#toggle-sunset" },
    { expect: ["#toggle-selected", "Selected: lion, sunset"] },
    // The disabled row is skipped.
    { key: "ArrowDown" },
    { focused: "#toggle-lion" },
    { key: "Enter" },
    { expect: ["#nature-action", "Last action: toggle lion"] },
    // replace: a press replaces the selection, arrows move it, double click runs the action.
    { click: "#replace-sunrise" },
    { expect: ["#replace-selected", "Selected: sunrise"] },
    { click: "#replace-sunset" },
    { expect: ["#replace-selected", "Selected: sunset"] },
    { key: "ArrowDown" },
    { expect: ["#replace-selected", "Selected: lion"] },
    { dblclick: "#replace-sunrise" },
    { expect: ["#nature-action", "Last action: replace sunrise"] },
  ],
});
