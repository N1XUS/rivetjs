import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Backdrop Variants",
  summary: 'Modal demo "Backdrop Variants".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button:nth-of-type(2)" }, { matches: ".modal__backdrop--blur" }, { key: "Escape" }, { absent: "[role=dialog]" }],
});
