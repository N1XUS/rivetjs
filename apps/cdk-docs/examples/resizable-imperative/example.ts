import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: imperative API",
  summary: "usePanelRef / useGroupRef: collapse, expand and resize a panel, read or set the group layout from buttons.",
  tags: ["resizable", "split-pane", "window-splitter"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { click: "#imp-collapse" },
    { attr: ["#imp-sep", "aria-valuenow", "5"] },
    { click: "#imp-expand" },
    { attr: ["#imp-sep", "aria-valuenow", "30"] },
    { click: "#imp-resize" },
    { attr: ["#imp-sep", "aria-valuenow", "60"] },
    { click: "#imp-reset" },
    { click: "#imp-read" },
    { expect: ["#imp-status", '"imp-left":50'] },
  ],
});
