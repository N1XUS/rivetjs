import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AI chat",
  summary:
    "A full chat: conversation, a shimmering “Thinking…”, Markdown answers streamed from a local timer with a natural cadence (no network; words fade in, the turn grows smoothly, actions fade in when it ends), suggestions, and a composer with Stop.",
  tags: ["chat-conversation", "prompt-input", "markdown", "chat-message"],
  status: "experimental",
  frame: { height: 600 },
  show: ["src/routes/index.tsx"],
  test: [
    { click: "#ask-resume" },
    { expect: ["#ai-thread", "How does a page resume?"] },
    { matches: "#ai-thread .text-shimmer" },
    { matches: "#ai-thread [data-streaming=true] .markdown__word" },
    { expect: ["#ai-thread", "first interaction"] },
    { absent: "#ai-thread [data-streaming]" },
    { fill: ["#ai-prompt", "Tell me about signals"] },
    { press: ["#ai-prompt", "Enter"] },
    { expect: ["#ai-thread", "No virtual DOM"] },
  ],
});
