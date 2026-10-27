import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmojiReactionButton: Sizes",
  summary: "Three sizes: sm, md (default) and lg.",
  tags: ["emoji-reaction-button"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#erb-sizes .emoji-reaction-button--sm",
    },
    {
      matches: "#erb-sizes .emoji-reaction-button--lg",
    },
  ],
});
