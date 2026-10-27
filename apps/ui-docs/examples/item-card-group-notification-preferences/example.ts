import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "ItemCardGroup: Notification Preferences",
  summary: "Per-channel notification switches under a header with a description.",
  tags: ["item-card-group"],
  status: "experimental",
  frame: { height: 380 },
  show: ["src/routes/index.tsx"],
  test: [
    {
      name: ["#icg-notify", "Notifications"],
    },
  ],
});
