import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChainOfThought: Agent Trace",
  summary: "An agent run as a trace: each step has a status (complete, active, error, pending) and an optional lucide icon.",
  tags: ["chain-of-thought"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: [".chain-of-thought__steps", "Send the shortlist"] }],
});
