import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Modal: Sizes",
  summary: 'Modal demo "Sizes".',
  tags: ["modal"],
  status: "experimental",
  frame: { height: 420 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button:nth-of-type(4)" }, { matches: "[role=dialog].modal__dialog--lg" }, { key: "Escape" }, { absent: "[role=dialog]" }],
});
