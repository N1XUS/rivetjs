import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: linear with validation",
  summary: "A linear stepper: the next step opens only once the current one is valid; an optional step can be skipped.",
  tags: ["cdk", "stepper", "validation"],
  status: "experimental",
  frame: { height: 210, auto: true },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { attr: ["#signup-label-1", "aria-disabled", "true"] },
    { click: "#next-0" },
    { attr: ["#signup-label-0", "aria-selected", "true"] },
    { fill: ["#email", "ada@example.com"] },
    { click: "#next-0" },
    { attr: ["#signup-label-1", "aria-selected", "true"] },
    { expect: ["#signup-label-1", "Optional"] },
    { click: "#next-1" },
    { attr: ["#signup-label-2", "aria-selected", "true"] },
    { matches: "#signup-label-0[data-completed]" },
  ],
});
