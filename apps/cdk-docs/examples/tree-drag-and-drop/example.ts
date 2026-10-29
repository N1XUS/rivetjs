import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree: drag and drop",
  summary:
    "Reorder rows and move them into folders with useDragAndDrop: a drag button per row for keyboard and screen reader drags, native row drags for the mouse.",
  tags: ["tree", "collections", "drag and drop"],
  status: "experimental",
  frame: { height: 132, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#files-notes", "draggable", "true"] },
    { name: ["#files-notes [slot=drag]", "Drag Notes.txt"] },
    // Keyboard drag: ArrowRight moves from the row to its drag button, Enter starts the drag after the row; Home jumps
    // to the first drop target.
    { press: ["#files-notes", "ArrowRight"] },
    { focused: "#files-notes [slot=drag]" },
    { key: "Enter" },
    { focused: "[aria-label='Insert after Notes.txt']" },
    { key: "Home" },
    { focused: "[aria-label='Insert before Documents']" },
    { key: "Enter" },
    { attr: ["#files-notes", "aria-posinset", "1"] },
    // Mouse drag onto the middle of a folder row moves the row into it (collapsed: expand to see it).
    { drag: ["#files-documents", "#files-photos"] },
    { absent: "#files-documents" },
    { attr: ["#files-photos", "aria-expanded", "false"] },
    { click: "#files-photos-chevron" },
    { attr: ["#files-documents", "aria-level", "2"] },
  ],
});
