import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "TagGroup: With Error Message",
  summary: 'TagGroup demo "With Error Message".',
  tags: ["tag-group"],
  status: "experimental",
  frame: { height: 260 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[data-key=laundry]" }, { expect: ["[data-slot=description]", "Selected: laundry"] }],
});
