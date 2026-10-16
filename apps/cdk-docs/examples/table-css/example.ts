import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table with plain CSS",
  summary: "No class props: plain CSS on rv-Table, rv-Column, rv-Row and rv-Cell, keyed on data-selected, data-disabled, data-hovered and data-focus-visible.",
  tags: ["table", "styling", "css"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "#team.rv-Table" },
    { matches: "#team-name.rv-Column" },
    { attr: ["#team tr[data-key=alan]", "data-disabled", "true"] },
    { click: "#team-grace-name" },
    { attr: ["#team tr[data-key=grace]", "data-selected", "true"] },
    { attr: ["#team tr[data-key=grace]", "aria-selected", "true"] },
    { key: "ArrowUp" },
    { focused: "#team-ada-name" },
    { attr: ["#team-ada-name", "data-focus-visible", "true"] },
  ],
});
