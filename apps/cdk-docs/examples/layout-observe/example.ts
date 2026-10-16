import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "BreakpointObserver.observe()",
  summary:
    "createBreakpointObserver().observe(queries).subscribe(…) in a client effect: the current state at once, debounced changes later, destroy() completes.",
  tags: ["cdk", "layout", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["#count", "Emissions: 1"] }, { expect: ["#emissions li:nth-child(1)", "(max-width: 400px)="] }],
});
