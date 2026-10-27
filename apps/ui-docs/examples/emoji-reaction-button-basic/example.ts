import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmojiReactionButton: Usage",
  summary: "Reactions under a message: press to add yours, press again to take it back.",
  tags: ["emoji-reaction-button"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#erb-basic > button:nth-child(2)", "aria-pressed", "false"],
    },
    {
      click: "#erb-basic > button:nth-child(2)",
    },
    {
      attr: ["#erb-basic > button:nth-child(2)", "aria-pressed", "true"],
    },
    {
      expect: ["#erb-basic > button:nth-child(2) [data-slot=emoji-reaction-button-count]", "5"],
    },
  ],
});
