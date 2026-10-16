import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatListView: Usage",
  summary: "A conversation history list: title, preview and time; the open thread is current.",
  tags: ["chat-list-view"],
  status: "experimental",
  frame: { height: 300 },
  show: ["src/routes/index.tsx"],
  test: [
    { attr: ["#thread-porto", "aria-current", "true"] },
    { click: "#thread-sql" },
    { attr: ["#thread-sql", "aria-current", "true"] },
    { attr: ["#thread-porto", "aria-current", null] },
  ],
});
