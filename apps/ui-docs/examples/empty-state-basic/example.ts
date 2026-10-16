import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Empty state",
  summary: "The default No results found text, and a custom empty state with an icon, text and an action.",
  tags: ["empty-state"],
  status: "experimental",
  frame: { height: 184, auto: true },
  show: ["src/routes/index.tsx"],
  test: [
    {
      expect: ["#default", "No results found"],
    },
    {
      matches: "#inbox.empty-state svg",
    },
    {
      click: "#compose",
    },
    {
      expect: ["#drafts", "1"],
    },
  ],
});
