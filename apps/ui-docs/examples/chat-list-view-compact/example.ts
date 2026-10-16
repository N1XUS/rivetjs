import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ChatListView: Compact",
  summary: "The compact variant for sidebars: one line per thread, grouped by day with sections.",
  tags: ["chat-list-view"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: ".chat-list-view--compact" }, { click: "#compact-cv" }, { attr: ["#compact-cv", "aria-current", "true"] }],
});
