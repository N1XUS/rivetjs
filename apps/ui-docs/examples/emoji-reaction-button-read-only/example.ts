import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmojiReactionButton: Read-only",
  summary: "isReadOnly shows the reactions without letting people change them (an archived thread, a preview).",
  tags: ["emoji-reaction-button"],
  status: "experimental",
  frame: { height: 160 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      attr: ["#erb-read-only button", "data-readonly", "true"],
    },
    {
      click: "#erb-read-only button",
    },
    {
      attr: ["#erb-read-only button", "aria-pressed", "true"],
    },
  ],
});
