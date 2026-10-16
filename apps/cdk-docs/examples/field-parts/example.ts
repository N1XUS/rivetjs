import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Label and Text element types",
  summary: "Label as a <span> naming a group through aria-labelledby, and Text rendered as span, div or p with its slot attribute.",
  tags: ["label", "text"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "span#when-label.rv-Label" },
    { name: ["#when", "Delivery window"] },
    { described: ["#when", "Pick a morning or an afternoon."] },
    { matches: "p#when-help[slot='description']" },
    { matches: "div#when-note[slot='note']" },
  ],
});
