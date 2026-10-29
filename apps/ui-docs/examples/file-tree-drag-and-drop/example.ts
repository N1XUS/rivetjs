import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "FileTree: Drag And Drop",
  summary: "useFileTreeDrag over createTreeData: reorder rows, drop on a folder to move into it; a drag handle per row for keyboard drags.",
  tags: ["file-tree", "drag and drop"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#ft-dnd [role=row][data-key=readme]", "draggable", "true"] },
    { name: ["#ft-dnd [role=row][data-key=readme] [slot=drag]", "Drag README.md"] },
    // Keyboard drag: Right Arrow moves from the row to its drag handle, Enter starts the drag; Home = first drop target.
    { press: ["#ft-dnd [role=row][data-key=readme]", "ArrowRight"] },
    { focused: "#ft-dnd [role=row][data-key=readme] [slot=drag]" },
    { key: "Enter" },
    { focused: "[aria-label='Insert between README.md and package.json']" },
    { key: "Home" },
    { focused: "[aria-label='Insert before src']" },
    { key: "Enter" },
    { attr: ["#ft-dnd [role=row][data-key=readme]", "aria-posinset", "1"] },
    { expect: ["#ft-dnd-status", "readme moved before src"] },
    // Mouse drag onto the middle of a folder row moves the row into it (collapsed: expand to see it).
    { drag: ["#ft-dnd [role=row][data-key=package]", "#ft-dnd [role=row][data-key=assets]"] },
    { absent: "#ft-dnd [role=row][data-key=package]" },
    { expect: ["#ft-dnd-status", "package moved on assets"] },
    { click: "#ft-dnd [role=row][data-key=assets] [slot=chevron]" },
    { attr: ["#ft-dnd [role=row][data-key=package]", "aria-level", "2"] },
  ],
});
