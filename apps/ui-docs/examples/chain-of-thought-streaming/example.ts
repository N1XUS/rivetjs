import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChainOfThought: Streaming",
  summary: "Steps arrive one by one from a local timer while the trigger label shimmers (`isStreaming`).",
  tags: ["chain-of-thought"],
  status: "experimental",
  frame: { height: 400 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#cot-run" },
    { matches: ".chain-of-thought[data-streaming]" },
    { expect: [".chain-of-thought__steps", "Pick the best option"] },
    { expect: [".chain-of-thought__trigger", "Thought for"] },
  ],
});
