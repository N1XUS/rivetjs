import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Streaming reply",
  summary:
    "A composer whose Enter key submits through isSubmitKey (Shift+Enter keeps a new line); streamText appends a simulated stream to a signal while the send Button is pending.",
  tags: ["chat", "streaming"],
  status: "experimental",
  frame: { height: "sm" },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [
    { fill: ["#chat-input", "Weekly numbers"] },
    { press: ["#chat-input", "Enter"] },
    { expect: ["#chat-question", "Weekly numbers"] },
    { expect: ["#chat-reply", "Your report is ready."] },
  ],
});
