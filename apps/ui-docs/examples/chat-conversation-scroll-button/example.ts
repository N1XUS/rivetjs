import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatConversation: Scroll Button",
  summary: "Scroll up in a long thread: the scroll button appears and jumps back to the newest message.",
  tags: ["chat-conversation"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [
    { matches: "#long-thread[data-at-bottom=true]" },
    { wheel: ["#long-thread", -600] },
    { absent: "#long-thread[data-at-bottom]" },
    { click: "[aria-label='Scroll to bottom']" },
    { matches: "#long-thread[data-at-bottom=true]" },
  ],
});
