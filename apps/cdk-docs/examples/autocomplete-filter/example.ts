import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Autocomplete: filter and input value",
  summary: "A prefix filter from `createFilter().startsWith`, the text owned by an `inputValue` signal, and a button that sets it.",
  tags: ["autocomplete", "filter", "controlled"],
  status: "experimental",
  frame: { height: "md" },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#q", "s"] },
    { expect: ["#query", "Query: s"] },
    { matches: '[role=menuitem][data-key="save"]' },
    { matches: '[role=menuitem][data-key="split"]' },
    // Prefix match: "Close window" contains an "s" but does not start with one.
    { absent: '[role=menuitem][data-key="close"]' },
    { click: "#preset" },
    { attr: ["#q", "value", "cl"] },
    { matches: '[role=menuitem][data-key="close"]' },
    { absent: '[role=menuitem][data-key="save"]' },
  ],
});
