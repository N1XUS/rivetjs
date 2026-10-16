import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: nested groups",
  summary: "A vertical group inside a horizontal one: each separator resizes its own group.",
  tags: ["resizable", "split-pane", "window-splitter"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { press: ["#inner-sep", "ArrowUp"] },
    { attr: ["#inner-sep", "aria-valuenow", "55"] },
    { press: ["#outer-sep", "ArrowRight"] },
    { attr: ["#outer-sep", "aria-valuenow", "35"] },
  ],
});
