import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList",
  summary: "A list of interactive rows with multiple selection: selection checkboxes, descriptions, arrow keys, Space toggles, typeahead.",
  tags: ["grid-list", "selection", "keyboard"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#files", "role", "grid"] },
    { attr: ["#files", "aria-multiselectable", "true"] },
    { attr: ["#files-sunset", "role", "row"] },
    { matches: "#files-sunset > [role=gridcell]" },
    { attr: ["#files-sunset", "aria-selected", "false"] },
    // The description joins the row name (aria-labelledby = row + description).
    { name: ["#files-sunset", "PNG"] },
    { attr: ["#files-sunset [slot=selection] input", "aria-label", "Select"] },
    { click: "#files-notes [slot=selection]" },
    { attr: ["#files-notes", "aria-selected", "true"] },
    { matches: "#files-notes [slot=selection] input:checked" },
    { press: ["#files-sunset", "ArrowDown"] },
    { focused: "#files-notes" },
    { key: "ArrowDown" },
    { focused: "#files-trailer" },
    { key: "Space" },
    { attr: ["#files-trailer", "aria-selected", "true"] },
    // Typeahead: "t" jumps to Theme song.
    { key: "t" },
    { key: "h" },
    { focused: "#files-theme" },
    { key: "Home" },
    { focused: "#files-sunset" },
    { click: "#files-sunset" },
    { attr: ["#files-sunset", "aria-selected", "true"] },
  ],
});
