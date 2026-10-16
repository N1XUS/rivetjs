import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Placements",
  summary: 'Toast demo "Placements".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button:nth-of-type(3)" }, { matches: ".toast-region--top-end [role=alertdialog]" }],
});
