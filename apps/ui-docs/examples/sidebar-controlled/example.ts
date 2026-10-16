import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Sidebar: controlled",
  summary: "open is a two-way signal: a button outside the sidebar and the trigger change the same state.",
  tags: ["sidebar", "navigation", "controlled"],
  status: "experimental",
  frame: { height: 420, width: "full" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#sbc-state", "open"] },
    { click: "#sbc-toggle" },
    { attr: ['[data-slot="sidebar"]', "data-state", "collapsed"] },
    { expect: ["#sbc-state", "closed"] },
    { click: "#sbc-trigger" },
    { expect: ["#sbc-state", "open"] },
  ],
});
