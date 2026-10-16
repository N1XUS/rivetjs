import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Placement",
  summary: 'Modal demo "Placement".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button:nth-of-type(2)" }, { matches: "[role=dialog][data-placement=top]" }, { key: "Escape" }, { absent: "[role=dialog]" }],
});
