import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree state",
  summary:
    "createTreeState with expanded keys: treeCollection lists only the visible rows, toggleTreeKey and setExpandedKeys change them, treeSelectionManager selects.",
  tags: ["collections", "tree"],
  status: "experimental",
  frame: { height: 170, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#visible", "src lib main readme"] },
    { click: "#row-lib button" },
    { expect: ["#visible", "src lib list main readme"] },
    { click: "#row-src button" },
    { expect: ["#visible", "src readme"] },
    { click: "#expand-all" },
    { expect: ["#visible", "src lib list main readme"] },
    { click: "#row-list button:nth-child(2)" },
    { attr: ["#row-list button:nth-child(2)", "aria-pressed", "true"] },
    { click: "#collapse-all" },
    { expect: ["#visible", "src readme"] },
  ],
});
