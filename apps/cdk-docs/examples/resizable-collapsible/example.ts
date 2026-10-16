import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: collapsible panel",
  summary: "A collapsible sidebar: drag past its minimum or press Enter on the separator to collapse it to its collapsed size.",
  tags: ["resizable", "split-pane", "window-splitter"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { expect: ["#c-status", "expanded"] },
    { press: ["#c-sep", "Enter"] },
    { attr: ["#c-sep", "aria-valuenow", "8"] },
    { expect: ["#c-status", "collapsed"] },
    { press: ["#c-sep", "Enter"] },
    { attr: ["#c-sep", "aria-valuenow", "30"] },
  ],
});
