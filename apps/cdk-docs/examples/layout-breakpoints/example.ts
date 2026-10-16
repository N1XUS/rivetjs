import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "breakpointState()",
  summary: "A signal of the BreakpointState for bindings: initial on the server, real values after connect() in a client effect; isMatched() in a handler.",
  tags: ["cdk", "layout", "basic"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#matches", "Any query matches: true"] },
    { expect: ["#queries li:nth-child(1)", "(min-width: 1px): true"] },
    { expect: ["#queries li:nth-child(2)", "(min-width: 1920px): false"] },
    { click: "#check" },
    { expect: ["#checked", 'isMatched("(max-width: 1px)"): false'] },
  ],
});
