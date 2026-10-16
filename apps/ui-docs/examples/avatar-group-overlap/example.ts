import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AvatarGroup: Overlap",
  summary: 'AvatarGroup demo "Overlap".',
  tags: ["avatar-group"],
  status: "experimental",
  frame: { height: 340 },
  show: ["src/routes/index.tsx", "src/styles.css"],
  test: [{ matches: '[data-slot="avatar-group"]' }],
});
