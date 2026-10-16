import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "AvatarGroup: Max",
  summary: 'AvatarGroup demo "Max".',
  tags: ["avatar-group"],
  status: "experimental",
  frame: { height: 96 },
  show: ["src/routes/index.tsx"],
  test: [{ expect: ["[data-slot=avatar-group-count]", "+2"] }],
});
