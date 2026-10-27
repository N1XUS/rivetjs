import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChainOfThought: Agent trace streaming",
  summary:
    "The agent trace while the agent works: a finished planning block, then a streaming block whose steps go pending → active → complete and fill in their results.",
  tags: ["chain-of-thought", "ai"],
  status: "experimental",
  frame: { height: 460, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#trace-step-3", "data-status", "complete"] },
    { click: "#trace-run" },
    { matches: "#trace-research[data-streaming]" },
    { attr: ["#trace-step-3", "data-status", "pending"] },
    { attr: ["#trace-step-0", "data-status", "complete"] },
    { attr: ["#trace-step-3", "data-status", "complete"] },
    { expect: ["#trace-research .chain-of-thought__trigger", "Researched venues"] },
  ],
});
