import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "runAfterTransition()",
  summary: "Wait for running CSS transitions to end before moving focus or measuring: the callback gets true after a transition, false when none ran.",
  tags: ["cdk", "utils", "events"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#now" },
    { expect: ["#log li:nth-child(1)", "no transition"] },
    { click: "#slide" },
    { expect: ["#log li:nth-child(2)", "after the transition"] },
  ],
});
