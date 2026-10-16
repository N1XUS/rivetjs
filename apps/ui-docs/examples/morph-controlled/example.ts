import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Morph: Controlled",
  summary: "isOpen takes a two-way signal: a button outside the morph opens it and the text follows every change.",
  tags: ["morph", "buttons"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#morph-controlled-state", "closed"] },
    { click: "#morph-controlled-toggle" },
    { matches: "#morph-controlled[data-open]" },
    { expect: ["#morph-controlled-state", "open"] },
    { click: "#morph-controlled-close" },
    { expect: ["#morph-controlled-state", "closed"] },
  ],
});
