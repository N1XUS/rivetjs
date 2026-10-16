import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Showcase: AI chat",
  summary:
    "An assistant chat built on the AI components: a conversation list, a thread with tool calls, sources and streamed Markdown answers (a shimmering pending line, words fading in), copy and feedback actions, suggestion pills and a composer with attachments and Stop. Answers are canned; no model is called.",
  tags: ["showcase", "chat-conversation", "chat-message", "prompt-input", "chat-list-view", "chat-tool", "markdown"],
  status: "experimental",
  frame: { height: 820 },
  show: ["src/routes/index.tsx"],
  test: [
    { expect: ["#chat-log", "12 halo lamps"] },
    { click: "#suggest-0" },
    { expect: ["#chat-log", "Summarise last week's sales"] },
    { matches: "#chat-log .text-shimmer" },
    { matches: "#chat-log [data-streaming=true] .markdown__word" },
    { expect: ["#chat-log", "214 orders and $11,940"] },
    { absent: "#chat-log [data-streaming]" },
    { fill: ["#chat-input", "Which products should I discount?"] },
    { click: "#chat-send" },
    { expect: ["#chat-log", "speckled mug and the knit beanie"] },
  ],
});
