import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Stepper: list semantics",
  summary: 'semantics="list": an ordered list with aria-current="step" and native buttons (a progress indicator), and a read-only timeline.',
  tags: ["cdk", "stepper", "list"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { matches: "ol#progress > li[aria-current=step]:first-child" },
    { click: "#progress-label-2" },
    { matches: "ol#progress > li[aria-current=step]:nth-child(3)" },
    { expect: ["#current", "3"] },
    { matches: "ol#timeline > li[aria-current=step]:nth-child(2)" },
    { absent: "#timeline button" },
  ],
});
