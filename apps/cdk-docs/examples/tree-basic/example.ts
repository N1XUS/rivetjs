import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Tree",
  summary: "A file tree: nested rows, a chevron button per parent row, arrow keys expand, collapse and move, typeahead.",
  tags: ["tree", "collections", "keyboard"],
  status: "experimental",
  frame: { height: 138, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#files", "role", "treegrid"] },
    { name: ["#files", "Files"] },
    { attr: ["#files-documents", "aria-expanded", "true"] },
    { attr: ["#files-documents", "aria-level", "1"] },
    { attr: ["#files-project", "aria-level", "2"] },
    { attr: ["#files-photos", "aria-expanded", "false"] },
    { absent: "#files-beach" },
    // Leaf rows have no aria-expanded.
    { attr: ["#files-readme", "aria-expanded", null] },
    { click: "#files-photos-chevron" },
    { attr: ["#files-photos", "aria-expanded", "true"] },
    { expect: ["#files-beach", "beach.jpg"] },
    { press: ["#files-documents", "ArrowLeft"] },
    { attr: ["#files-documents", "aria-expanded", "false"] },
    { absent: "#files-project" },
    { key: "ArrowRight" },
    { attr: ["#files-documents", "aria-expanded", "true"] },
    { key: "ArrowDown" },
    { focused: "#files-project" },
    // Typeahead: "b" jumps to beach.jpg.
    { key: "b" },
    { focused: "#files-beach" },
    { key: "Home" },
    { focused: "#files-documents" },
  ],
});
