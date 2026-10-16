import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Table: column resizing",
  summary:
    "ResizableTableContainer + ColumnResizer: defaultWidth / minWidth / maxWidth, keyboard resizing (Enter, arrows) and onResizeEnd with every column width.",
  tags: ["table", "resizing"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#resizable thead input[type=range]", "aria-label", "Resizer"] },
    { matches: "#resizable-size [data-resizable-direction]" },
    // Row header cell, then up into the header: focusMode "child" moves focus to the column's resizer input.
    { click: "#resizable tbody tr:first-child [role=rowheader]" },
    { key: "ArrowUp" },
    { focused: "#resizable-file input[type=range]" },
    { key: "Enter" },
    { matches: "#resizable-file [data-resizing]" },
    { key: "ArrowRight" },
    { key: "ArrowRight" },
    { key: "Enter" },
    { expect: ["#resizable-widths", "file="] },
    { expect: ["#resizable-widths", "size=100"] },
  ],
});
