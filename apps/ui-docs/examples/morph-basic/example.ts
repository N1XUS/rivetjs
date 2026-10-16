import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Morph: Usage",
  summary: "A bag pill that morphs into an order summary: View opens it, Keep shopping morphs it back, Escape or a press outside closes it.",
  tags: ["morph", "buttons"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [
    { absent: "#morph-basic[data-open]" },
    { click: "#morph-basic-view" },
    { matches: "#morph-basic[data-open]" },
    { expect: ["#morph-basic-panel h2", "Order summary"] },
    { click: "#morph-basic-keep" },
    { absent: "#morph-basic[data-open]" },
  ],
});
