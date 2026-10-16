import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AvatarGroup: Sizes",
  summary: 'AvatarGroup demo "Sizes".',
  tags: ["avatar-group"],
  status: "experimental",
  frame: { height: 308 },
  show: ["src/routes/index.tsx"],
  test: [{ matches: '[data-slot="avatar-group"]' }],
});
