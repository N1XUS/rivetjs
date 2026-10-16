import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: links",
  summary: "Rows with href in a replace-selection table: a click selects, Enter or a double click opens the link; the row is a tr with data-href.",
  tags: ["table", "links", "selection"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#bookmarks tbody tr[data-key=adobe]", "data-href", "https://adobe.com/"] },
    { attr: ["#bookmarks tbody tr[data-key=adobe]", "data-target", "_blank"] },
    { absent: "#bookmarks a" },
    { click: "#bookmarks tbody tr[data-key=google] td:nth-child(2)" },
    { attr: ["#bookmarks tbody tr[data-key=google]", "aria-selected", "true"] },
    { key: "ArrowDown" },
    { attr: ["#bookmarks tbody tr[data-key=nyt]", "aria-selected", "true"] },
    { attr: ["#bookmarks tbody tr[data-key=google]", "aria-selected", "false"] },
  ],
});
