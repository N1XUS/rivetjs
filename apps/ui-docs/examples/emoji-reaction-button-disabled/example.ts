import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmojiReactionButton: Disabled",
  summary: "isDisabled dims the button and ignores presses.",
  tags: ["emoji-reaction-button"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#erb-disabled button[disabled]",
    },
  ],
});
