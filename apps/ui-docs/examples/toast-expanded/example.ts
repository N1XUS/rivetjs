import { defineExample } from "@rivetjs/docs-kit/define.ts";

export default defineExample({
  title: "Toast: Expanded",
  summary: 'Toast demo "Expanded".',
  tags: ["toast"],
  status: "experimental",
  frame: { height: 360 },
  show: ["src/routes/index.tsx"],
  test: [{ click: "button" }, { matches: "[data-slot=toast-region][data-expanded=true]" }],
});
