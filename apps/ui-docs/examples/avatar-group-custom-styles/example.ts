import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AvatarGroup: Tailwind CSS",
  summary: 'AvatarGroup demo "Tailwind CSS".',
  tags: ["avatar-group"],
  status: "experimental",
  frame: { height: 98 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="avatar-group"]' }],
});
