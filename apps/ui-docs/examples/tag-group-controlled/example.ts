import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup: Controlled",
  summary: 'TagGroup demo "Controlled".',
  tags: ["tag-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-key=gaming]" }, { expect: ["[data-slot=description]", "news, travel, gaming"] }],
});
