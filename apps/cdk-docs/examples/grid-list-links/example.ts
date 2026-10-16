import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "GridList: links",
  summary: "Rows with href in a replace-selection list: a click selects, Enter or a double click opens the link (data-href on the row; rows are never <a>).",
  tags: ["grid-list", "links", "selection"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#bookmarks div[role=row]#bookmarks-adobe" },
    { attr: ["#bookmarks-adobe", "data-href", "https://adobe.com/"] },
    { attr: ["#bookmarks-adobe", "data-target", "_blank"] },
    { absent: "#bookmarks a" },
    // replace + links (linkBehavior "action"): a click selects instead of navigating.
    { click: "#bookmarks-google" },
    { attr: ["#bookmarks-google", "aria-selected", "true"] },
    { key: "ArrowDown" },
    { attr: ["#bookmarks-nyt", "aria-selected", "true"] },
    { attr: ["#bookmarks-google", "aria-selected", "false"] },
  ],
});
