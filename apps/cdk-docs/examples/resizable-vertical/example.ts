import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: vertical",
  summary: 'orientation="vertical" stacks the panels; the separator resizes with ArrowUp / ArrowDown.',
  tags: ["resizable", "split-pane", "window-splitter"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ attr: ["#v-sep", "aria-orientation", "horizontal"] }, { press: ["#v-sep", "ArrowDown"] }, { attr: ["#v-sep", "aria-valuenow", "35"] }],
});
