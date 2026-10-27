import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "EmptyState: with avatar group",
  summary: "A team's avatars and an invite action.",
  tags: ["empty-state"],
  status: "experimental",
  frame: { height: 320 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      matches: "#es-team .avatar-group",
    },
  ],
});
