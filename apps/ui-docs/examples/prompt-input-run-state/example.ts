import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "PromptInput: Run State",
  summary: "`status` drives Send: submitted and streaming turn it into Stop and lock the textarea; a local timer plays the run.",
  tags: ["prompt-input"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [
    { fill: ["#run-text", "Write a haiku"] },
    { click: "#run-send" },
    { expect: ["#run-status", "streaming"] },
    { name: ["#run-send", "Stop generating"] },
    { click: "#run-send" },
    { expect: ["#run-status", "ready"] },
  ],
});
