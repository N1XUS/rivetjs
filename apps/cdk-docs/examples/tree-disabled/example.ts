import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: disabled rows",
  summary: "disabledKeys and isDisabled; disabledBehavior all skips the row, selection keeps it focusable and expandable but not selectable.",
  tags: ["tree", "disabled", "selection"],
  status: "experimental",
  frame: { height: 162, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    // disabledBehavior="all": skipped by the arrow keys.
    { attr: ["#all-photos", "aria-disabled", "true"] },
    { attr: ["#all-photos", "data-disabled", "true"] },
    { press: ["#all-documents", "ArrowDown"] },
    { focused: "#all-music" },
    // disabledBehavior="selection": focusable, but a click does not select it.
    { press: ["#sel-documents", "ArrowDown"] },
    { focused: "#sel-photos" },
    { click: "#sel-photos" },
    { attr: ["#sel-photos", "aria-selected", null] },
    { attr: ["#sel-photos", "data-selected", null] },
    { click: "#sel-music" },
    { attr: ["#sel-music", "aria-selected", "true"] },
  ],
});
