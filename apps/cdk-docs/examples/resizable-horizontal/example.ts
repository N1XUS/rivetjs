import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Resizable: horizontal",
  summary: "Two panels side by side: drag the separator, or focus it and use the arrow keys / Home / End.",
  tags: ["resizable", "split-pane", "window-splitter"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#h-sep", "role", "separator"] },
    { press: ["#h-sep", "ArrowRight"] },
    { attr: ["#h-sep", "aria-valuenow", "45"] },
    { expect: ["#h-status", "45 / 55"] },
    { press: ["#h-sep", "End"] },
    { attr: ["#h-sep", "aria-valuenow", "80"] },
  ],
});
