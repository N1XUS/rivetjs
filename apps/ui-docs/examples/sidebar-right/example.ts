import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: right side",
  summary: "side right and variant floating set once on the provider; the trigger sits at the end of the header.",
  tags: ["sidebar", "layout"],
  status: "experimental",
  frame: { height: 360, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ['[data-slot="sidebar"]', "data-side", "right"] },
    { attr: ['[data-slot="sidebar"]', "data-variant", "floating"] },
    { click: "#sr-trigger" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
  ],
});
