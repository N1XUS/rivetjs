import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AvatarGroup: With Count",
  summary: 'AvatarGroup demo "With Count".',
  tags: ["avatar-group"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="avatar-group"]' }],
});
