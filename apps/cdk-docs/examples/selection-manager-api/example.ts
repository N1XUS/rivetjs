import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "SelectionManager API",
  summary:
    "SelectionManager methods on a built ListCollection: replaceSelection, extendSelection (ranges skip disabled keys), toggleSelection, select, selectAll, toggleSelectAll, clearSelection.",
  tags: ["selection", "react-aria"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#report", "none | first: - | last: - | empty: true"] },
    { expect: ["#can-select", 'canSelectItem("d"): false, isDisabled("d"): true'] },
    { click: "#replace-b" },
    { expect: ["#report", "b | first: b | last: b | empty: false"] },
    // The range b..e leaves the disabled d out.
    { click: "#extend-e" },
    { expect: ["#report", "b, c, e | first: b | last: e"] },
    { click: "#toggle-c" },
    { expect: ["#report", "b, e | first: b | last: e"] },
    // select() on a disabled key does nothing.
    { click: "#select-d" },
    { expect: ["#report", "b, e |"] },
    { click: "#select-all" },
    { expect: ["#report", "all | first: a | last: e"] },
    { click: "#toggle-all" },
    { expect: ["#report", "none | first: - | last: - | empty: true"] },
    { click: "#toggle-all" },
    { expect: ["#report", "all |"] },
    { click: "#clear" },
    { expect: ["#report", "none |"] },
  ],
});
