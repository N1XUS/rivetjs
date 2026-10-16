import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Segment: Icon Expand",
  summary: "Render-prop children: unselected items show their icon only, the selected one adds its label.",
  tags: ["segment"],
  status: "experimental",
  frame: { height: 220 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "[aria-label=Starred]" }, { expect: ["[aria-label=Starred]", "Starred"] }],
});
